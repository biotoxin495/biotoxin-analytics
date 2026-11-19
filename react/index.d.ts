import type {ReactNode, ReactElement} from 'react';
import type {Analytics, Snapshot} from '../dist/index.js';
export function AnalyticsProvider(props:{client:Analytics;page:string;children?:ReactNode}):ReactElement;
export function useAnalytics():Analytics;
export function useAnalyticsSnapshot():Snapshot;
export type ConsentCopy=Partial<Record<'heading'|'description'|'privacy'|'decline'|'accept'|'close',string>>;
export function ConsentBanner(props:{privacyHref?:string;className?:string;copy?:ConsentCopy}):ReactElement|null;
export function AnalyticsSettingsButton(props:{children?:ReactNode;className?:string}):ReactElement|null;
