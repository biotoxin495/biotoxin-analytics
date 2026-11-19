# Biotoxin Analytics

A consent-first, reusable Google Analytics 4 integration for independently deployed Biotoxin portfolio websites. One application, one measurement ID, one client per browser document. No backend, Firebase dependency, runtime package dependencies in the core, or centrally hosted JavaScript endpoint.

**Version:** 0.1.0 · Node 20+ for development · React 18/19 optional · ESM

## Repository setup

1. Extract this repository and upload its contents to `biotoxin495/biotoxin-analytics` on GitHub (suggested name; choose visibility yourself).
2. In GitHub, create the `v0.1.0` release/tag after uploading all files. The compiled `dist/` is intentionally checked in; do not delete it.
3. For maintenance, run `npm install`, `npm run check`, commit any changes to `dist/` and release a new immutable version. CI checks that output is current.
4. In each consuming frontend, install the pinned version (assuming the suggested repository name):

```sh
npm install 'git+https://github.com/biotoxin495/biotoxin-analytics.git#v0.1.0'
```

A public repo is simplest for portfolio builds; never store credentials here. For private repos, use an authorized build credential or release an npm tarball to an authenticated registry. Avoid putting personal tokens in Git URLs or committed lockfiles. The package is marked `private` to prevent accidental npm publication. To use a tarball, run `npm pack` and install that `.tgz` in a consumer; prefer immutable, versioned releases. No separate Coolify service is needed.

## Quick start — React / Vite

Create one client in `src/analytics.ts`, outside React components. Only explicitly registered public route categories and event fields are accepted.

```ts
import { createAnalytics } from '@biotoxin/analytics';

export const analytics = createAnalytics({
  measurementId: import.meta.env.VITE_GA_MEASUREMENT_ID,
  enabled: import.meta.env.PROD,
  allowedHosts: ['budzets.biotoxin.dev'],
  consentVersion: '1',
  pages: {
    home: {path: '/', title: 'Home'},
    budgets: {path: '/#/budgets', title: 'Budgets'},
    privacy: {path: '/#/privacy', title: 'Privacy notice'},
  },
  events: {
    module_open: {module: {type: 'enum', values: ['budgets', 'institutions']}},
    data_export: {format: {type: 'enum', values: ['csv', 'xlsx']}},
  },
});
```

Mount inside the router; map the router's current location to a static key. Use a fixed privacy destination and include settings in a persistent footer or privacy page.

```tsx
import { AnalyticsProvider, ConsentBanner, AnalyticsSettingsButton } from '@biotoxin/analytics/react';
import '@biotoxin/analytics/styles.css';
import { analytics } from './analytics';

// Pass a safe page key from your app's actual route registry.
export function AppShell({ page, children }: {page: string; children: React.ReactNode}) {
  return <AnalyticsProvider client={analytics} page={page}>
    {children}
    <footer><AnalyticsSettingsButton /></footer>
    <ConsentBanner privacyHref="/#/privacy" />
  </AnalyticsProvider>;
}
```

```ts
analytics.track('module_open', {module: 'budgets'});
analytics.track('data_export', {format: 'csv'});
```

Events are dropped before consent, until the Google script loads, and if the event or parameter is invalid. Do not retry dropped events or buffer pre-consent actions. A true return means the command was handed to the Google tag, not verified delivery. React users may call `useAnalytics()` within the provider and `useAnalyticsSnapshot()` for reactive status. For plain JS use the core directly: `start('home')`, `page('budgets')`, `setConsent('granted'|'denied')`, `track(...)`, `subscribe(...)`. Provide equivalent consent UI and a readily accessible withdrawal control. See `examples/react-vite/` and `docs/INTEGRATION.md`.

## Configure GA4 before deployment

- Reuse/create an individual GA4 property and web stream for each public app. Set the correct measurement ID, e.g. in Coolify's build-time `VITE_GA_MEASUREMENT_ID` variable. Rebuild to apply changes. There is no secret in this ID.
- **Turn Enhanced Measurement off** on the web stream for this manual-tracking package. In particular, automatic history page views would otherwise duplicate manually emitted page views, and automatic search/form/link events could expose data. Disable advertising features, Google Signals, cross-domain linking, user-provided data collection, and enable email/query redaction where applicable. Verify no additional destinations or automatic tags are associated with the Google tag.
- Remove old inline Google tags, Firebase Analytics initialization, GTM and other analytics components from the app; do not run this package in parallel with them. For the existing portfolio, keep its original GA4 property if you own it but ask for consent again. The new package does not import legacy consent or delete old shared GA cookies automatically.
- Restrict deployment to public content. Do not load analytics in private/auth/admin workflows, financial-statement processors, or private conversation-export tools. If a site has both public and sensitive content, use separate browser documents (full page navigation, preferably separate origin) so the private document never loads the tag. An SPA route switch alone cannot unload third-party code already executing in the document.
- Review site-specific privacy notices and CMP/legal requirements separately. The package is designed for opt-in analytics; it does not certify GDPR compliance or configure the Google account.

## Behaviour and limitations

- No Google script or analytics commands before affirmative consent. On first acceptance the script loads; only after load and confirming consent is still valid are measurement commands sent. Consent defaults deny all storage; only analytics storage is granted. No advertising consent is requested.
- Consent is isolated by origin and measurement ID, expires after 180 days by default, and syncs via browser storage across tabs on the same origin. You can change `consentVersion` to require new consent. The banner is nonmodal and both choices have equal styling. A declined or blocked-storage visitor can keep using the app.
- On withdrawal, `ga-disable-*` is set, consent is updated to denied if configured, future package events are dropped, and known package-prefixed GA cookies are deleted on a best-effort basis. Already sent data cannot be withdrawn, and a loaded third-party script cannot be reliably unloaded. A full reload gives a clean no-tag document. Review cookie names in actual browser QA.
- Page tracking uses developer-authored route templates and static titles, drops raw queries/fragments except curated hash routes, and reduces the initial external referrer to its origin. Custom params are bounded numbers, booleans or explicitly enumerated tokens. Static configuration is still trusted: never put personal data or arbitrary dynamic IDs in it; Google's own SDK collection is separate from the package's sanitization.
- Unknown page keys permanently stop the client for the current document. This is deliberate fail-closed behaviour. Register all safe route categories including public error pages. A page key must never be mapped from arbitrary user input. No auto-history patching.
- A single browser document cannot initialize multiple independent package clients. Hostnames must match exactly and use HTTPS. Development and preview traffic is disabled by default when `enabled` is false or the hostname is absent from `allowedHosts`.
- Google scripts can be blocked by network/browser policies. The app remains usable; errors are reflected with `status: 'error'`. Recovery is a reload. No analytics delivery guarantee.

## Development and verification

```sh
npm install
npm run check
npm pack --dry-run
```

`npm run check` builds declarations and JavaScript, runs the Node mock-browser regression suite, and syntax-checks the React adapter. Live browser and GA4 validation is a separate required integration step. See the acceptance checklist in `docs/INTEGRATION.md`. React is a peer dependency only; the consumer owns its React version.

## References

- [Google Basic Consent Mode](https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic)
- [GA4 manual page views](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Avoid sending personal information](https://support.google.com/analytics/answer/6366371)
- [Google cookie settings](https://developers.google.com/tag-platform/security/guides/customize-cookies)
- [GA4 data redaction](https://support.google.com/analytics/answer/13544947)
