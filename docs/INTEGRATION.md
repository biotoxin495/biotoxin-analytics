# Portfolio rollout and acceptance checklist

## Scope

This is the reusable package only. Each consumer owns route definitions, event schemas, public deployment hostnames, the GA4 property, privacy text and the decision to enable analytics. Keep Allava and private Biotoxin systems out of this release. No changes to consuming repositories are required to prepare this repository.

## Steps per frontend

1. Inspect router, build pipeline, current tags and privacy boundaries. Confirm actual production hostname. For the portfolio replace `src/components/GoogleAnalytics.jsx` and adapt the existing settings entry point; do not install alongside it. Keep the existing measurement ID `G-46ZKHVBK58` only if confirmed in your own GA4 account. Old consent is deliberately not migrated; check for previous GA cookies and plan a targeted migration only where ownership/scope is known.
2. Install the tagged shared dependency and commit the lockfile in the consuming repository.
3. Set `VITE_GA_MEASUREMENT_ID` for the production build. For Vite, `import.meta.env.PROD` is a build-mode check, not sufficient by itself; use the exact allowed-host list as well. With Docker, pass a build argument through to the build stage. Never rely on runtime environment changes for compiled Vite code unless the app has explicit runtime config.
4. Create a module singleton client. Identify every public route category; group dynamic `/items/:id` routes into a single static `/items/detail` page label. Do not include raw path, query, hash, search, record ID, document title, username, or contents. If the app includes sensitive content, isolate in separate documents before integrating.
5. Add the provider/banner and a persistent settings control. Use the real privacy link, review text, customize CSS variables or copy as needed. If another CMP controls analytics, use the core API with one consent source; do not duplicate banners.
6. Define only useful low-cardinality business events (see below). Wire to completed actions, avoid polling, typing, keystroke, hover, and automatic click telemetry. Do not send data from forms, API bodies or user files. Register event-scoped custom dimensions in GA4 under Admin > Custom definitions when needed.
7. GA4: turn off Enhanced Measurement, advertising features and unwanted linked destinations. Enable email redaction and approved query redaction. Test all privacy settings and policies in the relevant account.
8. Set an appropriate CSP for the Google script/collection endpoints if site CSP blocks them; use Google's current guidance to allow the minimum appropriate origins. Do not weaken protections globally. Use the nonce field if applicable. See https://developers.google.com/tag-platform/security/guides/csp .
9. Run local checks and build. Deploy; perform browser acceptance checklist below. Keep release rollback available (restore previous package and configuration).

## Event schema examples

| Event | Parameters (examples) |
|---|---|
| `module_open` | `module`: enum `budgets`, `institutions`, `procurement` |
| `data_export` | `format`: enum `csv`, `xlsx`, `json` |
| `collection_open` | `collection_type`: fixed enum of public categories |
| `layer_toggle` | `layer`: approved enum, `visible`: boolean |
| `lookup_complete` | `success`: boolean |

The package accepts optional schema parameters only. It rejects unknown keys/values and never forwards raw event payloads. Numeric values must be finite and within configured bounds; use coarse aggregates rather than precise location, unique IDs or user-level financial values. Do not add dynamic enums containing user data. `page_view` and other built-in events are reserved. Choose lowercase snake_case, max 40 characters for event and param names; prefer a few dimensions, not per-item IDs.

## Manual browser acceptance (every production site)

Use a fresh browser profile and disable extensions only for this controlled QA. Open DevTools Network with preserve log and inspect requests and storage.

| Test | Required result |
|---|---|
| Fresh visit; wait, navigate, use app before responding | No gtag.js or Google Analytics collection request caused by this package; no analytics cookies. Banner present. |
| Decline; refresh and navigate | No analytics script or collection. Decline remains stored, app fully usable. |
| Settings > Allow | One Google tag script; one `page_view` for current public route after load. No prior actions replayed. |
| Navigate between two safe route categories | One manual page_view per distinct consecutive route key. No duplicate via Enhanced Measurement. |
| Trigger registered event | Correct name/params in Network and GA4 Realtime/DebugView. No sensitive metadata. |
| Inspect requests at route with test query and dynamic ID | No test secret, private title, raw query or identifier in payloads. Check Google SDK automatic parameters as well; configure tag or block deployment if unsafe. |
| Open another tab; withdraw via settings | Existing tabs cease package collection; inspect cookies, verify `ga-disable-*`, then reload. No new script after reload. A loaded SDK may emit consent-state or already-in-flight requests; inspect actual behavior. |
| Accept again | Single tag, one new current page view. |
| Block Google script or storage | App remains usable; no duplicate script. |
| Preview host and local build | No analytics tag from the package. |
| Public-to-sensitive navigation | Full page load into an independent document with zero analytics script. No private SPA injection. |
| Existing portfolio migration | Only new integration present; original GA property used if verified; no inherited consent. |

Google reporting may lag; test with Realtime or DebugView on an explicitly consented session, use `debug: true` only when needed, then turn it off. Do not use DebugView to send private payloads.

## Privacy notice drafting inputs

Before rollout, state who operates the site, purpose (optional aggregate usage measurement), Google Analytics/Google as recipient or processor as appropriate, what data is collected (including device/network-derived data and pseudonymous identifiers), cookie names/actual retention, legal basis, international transfers/safeguards, rights and contact, and how to change consent. Verify against the actual configuration and applicable law. Don't copy a generic claim that no personal data is processed. Analytics is not essential for the app.

## Future central dashboard

The browser package only sends permitted events to the project's own GA4 property. A later control-centre backend can use the GA Data API with a read-only service account and numeric property IDs. Never place service-account credentials or Measurement Protocol secrets in frontend builds. A property-level sum of unique users is not deduplicated across apps.
