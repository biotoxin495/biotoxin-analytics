import type {ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {AnalyticsProvider, AnalyticsSettingsButton, ConsentBanner} from '@biotoxin/analytics/react';
import '@biotoxin/analytics/styles.css';
import {analytics} from './analytics';
function publicPageKey(pathname:string):string {
  if(pathname==='/')return 'home';
  if(pathname==='/items')return 'listing';
  if(/^\/items\/[a-z0-9-]+$/i.test(pathname))return 'detail';
  if(pathname==='/privacy')return 'privacy';
  return 'unregistered';
}
export function AnalyticsShell({children}:{children:ReactNode}){
  const {pathname}=useLocation();
  return <AnalyticsProvider client={analytics} page={publicPageKey(pathname)}>
    {children}
    <footer><AnalyticsSettingsButton /></footer>
    <ConsentBanner privacyHref="/privacy" />
  </AnalyticsProvider>;
}
