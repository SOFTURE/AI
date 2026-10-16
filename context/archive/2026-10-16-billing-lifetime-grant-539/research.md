---
change_id: billing-lifetime-grant-539
---

# Research: billing-lifetime-grant-539

Sources: `modules/billing/src/server/grants.ts`, `src/server/plans.ts`, `src/plans.ts`, `src/options.ts`,
`src/server/limits.ts`, `src/server/privacy.ts`, `src/next/actions.ts`, `src/next/pages.tsx`, `src/scripts/plan-scripts.ts`,
`src/scripts/entitlement-scripts.ts`, `migrations/0004_create_requests_and_grants.sql`, `migrations/0006_*.sql`.

- `grantPlanManually` locks the account and the entitlement, refuses lifetime, closes a request, applies the plan
  through `applyPlan` (`changeEntitlement` + `getPaymentGrant`) and inserts one `manual_grants` row. Lifetime access
  is `changeEntitlement(..., { type: "grant_lifetime" })`, whose grant is `{ kind: "lifetime" }`.
- `manual_grants.plan_id` is `text NOT NULL CHECK (length BETWEEN 1 AND 64)`, no foreign key; `amount`/`currency`
  are a nullable pair. Plan ids are validated as kebab-case, so `"_lifetime"` can never be declared.
- `revokeManualGrant` and `takeBackGrant` work on the recorded grant kind, not the plan, so a plan-less lifetime is
  revoked like a lifetime plan grant.
- `findCurrentPlanId` (limits) returns the recorded plan id; an undeclared id falls back to `paid.limits`, as for an
  import. The privacy export lists the id as stored.
- The admin page names history rows by `getPlanName` (falls back to the raw id), so the lifetime id needs its own name.
- `import-entitlements` reads `--file` with `readFile` inside the script's transaction; the ops runner reads stdin only
  for `secrets` keys.
