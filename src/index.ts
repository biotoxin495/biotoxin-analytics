/** Public route labels and enumerated event values must be developer-authored, never user input. */
export type Consent = 'unknown' | 'granted' | 'denied';
export type Status = 'disabled' | 'idle' | 'loading' | 'ready' | 'error';
export type Page = Readonly<{path: string; title: string}>;
export type Parameter = {type:'enum'; values: readonly string[]} | {type:'number'; min:number; max:number} | {type:'boolean'};
export type EventSchema = Readonly<Record<string, Readonly<Record<string, Parameter>>>>;
export type Snapshot = Readonly<{consent:Consent; status:Status; settingsOpen:boolean}>;
export type Options = {
  measurementId?: string;
  /** Explicit production opt-in; no collection unless true. */
  enabled?: boolean;
  /** Exact allowed hostnames, without scheme or port. Required when enabled. */
  allowedHosts: readonly string[];
  /** Bump to request fresh consent when purposes or notice change. */
  consentVersion?: string;
  consentDays?: number;
  /** Static allowlist; select page keys on navigation. */
  pages: Readonly<Record<string, Page>>;
  events?: EventSchema;
  debug?: boolean;
  /** Optional CSP nonce for the script. */
  nonce?: string;
};
export interface Analytics {
  start(pageKey: string): void;
  page(pageKey: string): boolean;
  track(event: string, params?: Readonly<Record<string, unknown>>): boolean;
  setConsent(choice: 'granted'|'denied'): void;
  openSettings(): void;
  closeSettings(): void;
  subscribe(listener:()=>void):()=>void;
  getSnapshot(): Snapshot;
  /** Stop collection for the document lifetime, e.g. on entering a private route. */
  stop(): void;
}
const DEFAULT_DENIED = {analytics_storage:'denied', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'} as const;
const GRANTED = {...DEFAULT_DENIED, analytics_storage:'granted'} as const;
const BASE: Snapshot = Object.freeze({consent:'unknown',status:'disabled',settingsOpen:false});
export const serverSnapshot = ():Snapshot => BASE;
const own = (obj:object,key:string)=>Object.prototype.hasOwnProperty.call(obj,key);
const EVENT = /^[a-z][a-z0-9_]{0,39}$/;
const RESERVED = /^(ga_|google_|firebase_|gtag\b|page_view$|session_start$|first_visit$|user_engagement$|screen_view$|click$|scroll$|file_download$|form_start$|form_submit$|search$|error$)/;
const BLOCKED_PARAM = /^(?:user_id|client_id|session_id|page_.*|link_.*|file_.*|search_term|email|phone|name|address|url|ip|token|send_to|debug_mode|currency|value|event_.*|ga_.*|google_.*|firebase_.*)$/i;
const STATIC_TOKEN = /^[A-Za-z0-9_-]{1,64}$/;
const STATIC_PATH = /^\/(?:[a-zA-Z0-9_/-]*)(?:#[a-zA-Z0-9_/-]+)?$/;
const OWNER = Symbol.for('@biotoxin/analytics.owner');
type Browser = Window & {dataLayer?: unknown[]; gtag?: (...args:unknown[])=>void; [key: symbol]: unknown; [key: string]:unknown};
type RecordValue = {version:string;choice:'granted'|'denied';expires:number};

export function createAnalytics(options: Options): Analytics {
  // Copy configuration so consumer mutation can't replace the allowlist at runtime.
  const o = {...options, allowedHosts:[...options.allowedHosts]};
  const pages = new Map<string,Page>();
  for(const [key,p] of Object.entries(o.pages)) {
    if(!STATIC_TOKEN.test(key) || !STATIC_PATH.test(p.path) || p.path.startsWith('//') || p.path.includes('//#') || !p.title.trim() || p.title.length>100 || /[@<>\r\n]/.test(p.title)) throw new Error(`Invalid static page definition: ${key}`);
    pages.set(key,{...p});
  }
  const schemas = new Map<string,Map<string,Parameter>>();
  for(const [event,defs] of Object.entries(o.events??{})) {
    if(!EVENT.test(event)||RESERVED.test(event)) throw new Error(`Invalid custom event: ${event}`);
    if(Object.keys(defs).length>20) throw new Error(`Too many parameters: ${event}`);
    const params = new Map<string,Parameter>();
    for(const [name,rule] of Object.entries(defs)) {
      if(!EVENT.test(name)||BLOCKED_PARAM.test(name)) throw new Error(`Invalid parameter: ${name}`);
      if(rule.type==='enum') {
        if(!rule.values.length||rule.values.some(v=>!STATIC_TOKEN.test(v))) throw new Error(`Invalid enum: ${name}`);
        params.set(name,{type:'enum',values:[...rule.values]});
      } else if(rule.type==='number') {
        if(!Number.isFinite(rule.min)||!Number.isFinite(rule.max)||rule.min>rule.max) throw new Error(`Invalid range: ${name}`);
        params.set(name,{...rule});
      } else if(rule.type==='boolean') params.set(name,{type:'boolean'});
      else throw new Error(`Unknown parameter type: ${name}`);
    }
    schemas.set(event,params);
  }
  const id = o.measurementId?.trim()??'';
  const version = o.consentVersion??'1';
  const days = o.consentDays??180;
  if(!Number.isFinite(days)||days<=0||days>365) throw new Error('consentDays must be between 0 and 365');
  const key = `biotoxin.analytics.${id}.consent`;
  const prefix = `bt_${id.replace(/[^A-Z0-9]/g,'').toLowerCase()}`;
  const disableKey = `ga-disable-${id}`;
  const listeners=new Set<()=>void>();
  let snapshot: Snapshot=BASE;
  let w:Browser|undefined, d:Document|undefined;
  let started=false, stopped=false, installed=false, configured=false;
  let current: string|undefined, lastPage:string|undefined, lastLocation:string|undefined, currentReferrer:string|undefined;
  let expiry:number|undefined, expiryTimer:number|undefined;
  let script:HTMLScriptElement|undefined;
  const update = (patch:Partial<Snapshot>)=>{
    const next=Object.freeze({...snapshot,...patch});
    if(next.consent===snapshot.consent&&next.status===snapshot.status&&next.settingsOpen===snapshot.settingsOpen)return;
    snapshot=next; listeners.forEach(fn=>fn());
  };
  const readConsent = (raw:string|null):RecordValue|undefined=>{
    try { const rec=JSON.parse(raw??'null'); if(rec?.version===version&&(rec.choice==='granted'||rec.choice==='denied')&&Number.isFinite(rec.expires)&&rec.expires>Date.now()) return rec; }catch{}
    return undefined;
  };
  const command = (...args:unknown[])=>w?.gtag?.(...args);
  const clearCookies=()=>{
    if(!d)return;
    // Only cookies owned by this package/property prefix; no other apps' cookies.
    try { for(const cookie of d.cookie.split(';')) {
      const name=cookie.trim().split('=')[0];
      if([`${prefix}_ga`, `_${prefix}_ga`].some(base=>name===base||name.startsWith(`${base}_`))) {
        d.cookie=`${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
        if(w)d.cookie=`${name}=; Max-Age=0; Path=/; Domain=${w.location.hostname}; SameSite=Lax; Secure`;
      }
    }}catch{}
  };
  const stopSending=()=>{
    if(w)w[disableKey]=true;
    if(configured)command('consent','update',DEFAULT_DENIED);
    lastPage=undefined;lastLocation=undefined;currentReferrer=undefined;clearCookies();
  };
  const apply = (record:RecordValue|undefined)=>{
    if(stopped||!w)return;
    if(expiryTimer!==undefined)w.clearTimeout(expiryTimer);
    expiry=record?.expires;
    const choice=record?.choice??'unknown';
    if(choice!=='granted')stopSending();
    update({consent:choice});
    if(choice==='granted')activate();
    if(expiry!==undefined){
      const tick=()=>{if(!w||expiry===undefined||stopped)return; const remaining=expiry-Date.now(); if(remaining<=0)apply(undefined); else expiryTimer=w.setTimeout(tick,Math.min(remaining,2_147_000_000));};
      tick();
    }
  };
  const fresh=()=>{if(expiry!==undefined&&expiry<=Date.now())apply(undefined);return snapshot.consent==='granted';};
  const meta = ()=>{
    const p=current?pages.get(current):undefined;
    if(!p||!w)return undefined;
    return {page_location:w.location.origin+p.path, page_title:p.title, page_referrer:currentReferrer??referrerOrigin(d?.referrer??'')};
  };
  const sendPage = ()=>{
    if(!configured||!current||lastPage===current||stopped||!fresh())return false;
    currentReferrer=lastLocation??referrerOrigin(d?.referrer??'');
    const m=meta();if(!m)return false;
    command('set',m);
    command('event','page_view',{...m,send_to:id});
    lastPage=current;lastLocation=m.page_location;return true;
  };
  function activate(){
    if(!w||!d||!meta()||stopped||snapshot.consent!=='granted'||snapshot.status==='error')return;
    w[disableKey]=false;
    if(installed){if(snapshot.status==='ready')configure();return;}
    // Never take over an existing tag or data layer. Remove legacy tags first.
    if(w.gtag||w.dataLayer?.length||d.querySelector('script[src*="googletagmanager.com/"]')){
      w[disableKey]=true;update({status:'error'});return;
    }
    w.dataLayer=[];
    w.gtag=function(){w!.dataLayer!.push(arguments);};
    installed=true;
    // No measurement commands are queued until the script loads and consent is still valid.
    command('consent','default',DEFAULT_DENIED);
    script=d.createElement('script');script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    if(o.nonce)script.nonce=o.nonce;
    script.onload=()=>{if(!stopped){update({status:'ready'});if(fresh())activate();}};
    script.onerror=()=>{stopSending();update({status:'error'});};
    update({status:'loading'});
    try {d.head.appendChild(script);}catch{stopSending();update({status:'error'});}
  }
  function configure(){
    if(!w||!fresh()||stopped||!meta())return;
    command('consent','update',GRANTED);
    if(!configured){
      command('js',new Date());
      command('set',meta());
      command('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,cookie_domain:'none',cookie_prefix:prefix,cookie_expires:Math.floor(days*86400),cookie_update:false,...meta(),...(o.debug?{debug_mode:true}:{})});
      configured=true;
    }
    sendPage();
  }
  function onStorage(e:StorageEvent){if(e.key===key||e.key===null)apply(readConsent(e.key===null?null:e.newValue));}
  function onResume(){fresh();}
  const client:Analytics={
    start(pageKey){
      if(started||stopped||typeof window==='undefined'||typeof document==='undefined')return;
      started=true;
      if(!o.enabled||!/^G-[A-Z0-9]{6,20}$/.test(id)||!o.allowedHosts.includes(window.location.hostname)||window.location.protocol!=='https:')return;
      if(!pages.has(pageKey))return;
      w=window as unknown as Browser; d=document;
      if(w[OWNER]&&w[OWNER]!==client){w=undefined;d=undefined;return;}
      w[OWNER]=client; current=pageKey;w[disableKey]=true;
      update({status:'idle'});
      let saved:RecordValue|undefined;try{saved=readConsent(w.localStorage.getItem(key));}catch{}
      w.addEventListener('storage',onStorage);w.addEventListener('focus',onResume);d.addEventListener('visibilitychange',onResume);
      apply(saved);
    },
    page(pageKey){
      if(!pages.has(pageKey)){client.stop();return false;}
      if(!started||stopped||!w)return false;
      current=pageKey;return sendPage();
    },
    track(event,params={}){
      if(!w||stopped||!configured||snapshot.status!=='ready'||!fresh()||!current||!schemas.has(event))return false;
      const schema=schemas.get(event)!;const sanitized:Record<string,string|number>={};
      for(const [name,v] of Object.entries(params)){
        const rule=schema.get(name);if(!rule)return false;
        if(rule.type==='enum'&&typeof v==='string'&&rule.values.includes(v))sanitized[name]=v;
        else if(rule.type==='number'&&typeof v==='number'&&Number.isFinite(v)&&v>=rule.min&&v<=rule.max)sanitized[name]=v;
        else if(rule.type==='boolean'&&typeof v==='boolean')sanitized[name]=v?1:0;
        else return false;
      }
      const p=meta();if(!p)return false;command('event',event,{...sanitized,...p,send_to:id});return true;
    },
    setConsent(choice){
      if(!w||stopped||(choice!=='granted'&&choice!=='denied'))return;
      const record:RecordValue={version,choice,expires:Date.now()+days*86400000};
      try{w.localStorage.setItem(key,JSON.stringify(record));}catch{}
      update({settingsOpen:false});apply(record);
    },
    openSettings(){if(w&&!stopped)update({settingsOpen:true});},
    closeSettings(){update({settingsOpen:false});},
    subscribe(fn){listeners.add(fn);return()=>{listeners.delete(fn);};},
    getSnapshot(){return snapshot;},
    stop(){
      if(stopped)return;stopped=true;stopSending();
      if(w){if(expiryTimer!==undefined)w.clearTimeout(expiryTimer);w.removeEventListener('storage',onStorage);w.removeEventListener('focus',onResume);}
      d?.removeEventListener('visibilitychange',onResume);update({status:'disabled',settingsOpen:false});
    }
  };
  return client;
}
function referrerOrigin(value:string):string {
  try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.origin+'/':'';}catch{return '';}
}
