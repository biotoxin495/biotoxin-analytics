# Agent guidance

- Scope: shared analytics package for public Biotoxin portfolio projects, explicitly excluding Allava, identity/admin/private processing apps. No backend or central deployment.
- Preserve basic opt-in: absolutely no tag loading before affirmative consent, no pre-consent event buffering, no advertising consent, no user identification. Fail closed. Consent revocation must disable future tracking immediately.
- Static route allowlist and bounded event-schema validation are core privacy controls. Never introduce raw URLs, document titles, form fields, arbitrary strings, unique IDs or uploaded contents. Sensitive workflows require separate tag-free documents.
- No production IDs or secrets in this package. Each consumer configures its own measurement ID and exact hostname. No automatic router patching; disable GA4 Enhanced Measurement in consumer setup.
- Keep the React adapter optional, lightweight, accessible and themeable. Both consent buttons must have the same prominence; include settings control and real privacy link.
- Update regression tests and docs for changes. Run `npm run check`; commit generated `dist/` with source. Release new immutable tags; don't mutate old tags. The consuming applications pin versions.
