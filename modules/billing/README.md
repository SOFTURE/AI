# @softure-ai/billing

**Status:** wave 3 · not implemented · depends on: core, db, ui, auth

Entitlements `trial | paid | read_only` (a pure state machine), `requireWriteAccess`, access badges
and notices, pricing tiles built from plans in the configuration, a payment page. Payment adapter:
`manual()` (pro-forma invoice and bank transfer, as today), later Stripe/Przelewy24.

**Tables:** `billing.entitlements(user_id, paid_until, trial_ends_at, …)`, `billing.plans`*.
In the source project these are columns on `users` today.

**Source in FIRE_TRACKER:** `src/lib/{access,payment}.ts`, `src/db/access.ts`, `src/app/(app)/platnosc/`,
`src/app/cennik/`, `src/components/{pricing-tiles,access-badge,access-notice*}.tsx`, `scripts/dostep*`.

\* new
