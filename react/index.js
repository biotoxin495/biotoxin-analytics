import { createContext, createElement as h, useContext, useEffect, useSyncExternalStore, useRef } from 'react';
import { serverSnapshot } from '../dist/index.js';
const Context = createContext(null);
export function AnalyticsProvider({client, page, children}) {
  // Client must be a stable module singleton, including through Strict Mode re-renders.
  useEffect(()=>{ client.start(page); client.page(page); }, [client,page]);
  return h(Context.Provider,{value:client},children);
}
export function useAnalytics(){
  const client=useContext(Context);
  if(!client) throw new Error('useAnalytics requires AnalyticsProvider');
  return client;
}
export function useAnalyticsSnapshot(){
  const client=useAnalytics();
  return useSyncExternalStore(client.subscribe,client.getSnapshot,serverSnapshot);
}
export function ConsentBanner({privacyHref='/privacy', className='', copy={}}){
  const client=useAnalytics();
  const {consent,status,settingsOpen}=useAnalyticsSnapshot();
  const heading=useRef(null);
  const visible=status!=='disabled'&&(consent==='unknown'||settingsOpen);
  // Only focus when explicitly opening settings; initial prompt does not steal focus.
  useEffect(()=>{if(settingsOpen&&visible)heading.current?.focus();},[settingsOpen,visible]);
  if(!visible)return null;
  return h('aside',{className:`bt-analytics-consent ${className}`.trim(),'aria-label':copy.heading??'Optional analytics'},
    h('div',{className:'bt-analytics-copy'},
      h('strong',{ref:heading,tabIndex:-1},copy.heading??'Optional analytics'),
      h('p',null,copy.description??'We use Google Analytics to understand how this website is used. Analytics is optional, and you can change your choice at any time.',' ',h('a',{href:privacyHref},copy.privacy??'Privacy notice'))),
    h('div',{className:'bt-analytics-actions'},
      h('button',{type:'button',onClick:()=>client.setConsent('denied')},copy.decline??'Decline'),
      h('button',{type:'button',onClick:()=>client.setConsent('granted')},copy.accept??'Allow analytics'),
      settingsOpen&&consent!=='unknown'?h('button',{type:'button',onClick:()=>client.closeSettings()},copy.close??'Close'):null));
}
export function AnalyticsSettingsButton({children='Analytics settings',className=''}){
  const client=useAnalytics();
  const {status}=useAnalyticsSnapshot();
  if(status==='disabled')return null;
  return h('button',{type:'button',className,onClick:()=>client.openSettings()},children);
}
