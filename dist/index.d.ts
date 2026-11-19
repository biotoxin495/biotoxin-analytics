/** Public route labels and enumerated event values must be developer-authored, never user input. */
export type Consent = 'unknown' | 'granted' | 'denied';
export type Status = 'disabled' | 'idle' | 'loading' | 'ready' | 'error';
export type Page = Readonly<{
    path: string;
    title: string;
}>;
export type Parameter = {
    type: 'enum';
    values: readonly string[];
} | {
    type: 'number';
    min: number;
    max: number;
} | {
    type: 'boolean';
};
export type EventSchema = Readonly<Record<string, Readonly<Record<string, Parameter>>>>;
export type Snapshot = Readonly<{
    consent: Consent;
    status: Status;
    settingsOpen: boolean;
}>;
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
    setConsent(choice: 'granted' | 'denied'): void;
    openSettings(): void;
    closeSettings(): void;
    subscribe(listener: () => void): () => void;
    getSnapshot(): Snapshot;
    /** Stop collection for the document lifetime, e.g. on entering a private route. */
    stop(): void;
}
export declare const serverSnapshot: () => Snapshot;
export declare function createAnalytics(options: Options): Analytics;
