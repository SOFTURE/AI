# Plan: billing-usage-limits

## Goal

`billing({ trial: { limits }, paid: { limits }, readOnly: { limits }, plans: [{ ..., limits }] })`;
`getLimits(ctx, userId)` answers per state and plan; `consumeUsage(ctx, { userId, meter, amount,
period: "month" })` consumes quota atomically and returns `{ used, limit, remaining, periodStart,
resetsAt }` or `billing.quota_exhausted` with the same state; `getUsage` reads it without consuming.

## Phase 1: Limits in the config and their resolution

1. `options.ts`: a limits schema, `Record<meter, integer 0..1e9 | null>` (meter kebab-case like plan
   ids, `null` = unlimited), on `trial.limits`, `paid.limits`, new group `readOnly.limits`, and
   `plans[].limits`; all default `{}`.
2. `usage.ts` (pure): `getDeclaredMeters(options)`, `resolveLimit(options, { status, planId }, meter)`:
   trial → `trial.limits`, read-only → `readOnly.limits`, paid → the plan's limits, then
   `paid.limits`; a declared meter a block leaves out has limit 0. `getUsagePeriod(now, timezone,
   "month")` → `{ start, end }`.
3. `server/limits.ts`: `findCurrentPlanId(db, userId, now)` from payments and manual grants (lifetime
   first, else the period containing `now`); `getLimits(ctx, userId)` → `{ status, planId, limits }`
   or null.

Done when: unit tests for the schema, resolution and months (DST, year end) pass.

## Phase 2: The usage ledger

1. `migrations/0011_create_usage.sql`: `billing.usage (user_id → auth.users ON DELETE CASCADE, meter,
   period, period_start, used >= 0, updated_at)`, primary key `(user_id, meter, period,
   period_start)`.
2. `schema.ts`, manifest tables (`src/index.ts`, `module.json`), health probe.
3. `server/usage.ts`: `getUsage(ctx, { userId, meter })`, `consumeUsage(ctx, { userId, meter, amount
   = 1, period = "month" })`: one transaction, account `for key share`, limits resolved, conditional
   upsert; an undeclared meter or a bad amount throws (a bug). `billing.quota_exhausted` added to the
   codes and to `messages.en`.
4. Privacy: export `usage` rows, delete them.

Done when: PGlite tests (limits per state and plan, month rollover, refusal, transaction rollback,
GDPR) and a real-Postgres race test (concurrent consumers never pass the limit) pass.

## Phase 3: Docs

README (§3 options and a "Usage limits" part, §5 table, §11 GDPR), CHANGELOG `## Unreleased` with
how an adopting app moves its own counter to billing, package description.

## Decisions (auto)

- D1: the plan is derived from recorded grants, not stored on the entitlement: no migration of
  existing rows, and take-backs already keep grant dates true. Paid access without a grant falls back
  to `paid.limits`.
- D2: a meter undeclared everywhere is a programming error (throws); a declared meter missing from a
  state's block is 0 (deny by default); `null` is the explicit "unlimited".
- D3: `period` accepts only `"month"` now; it is a column of the key so other periods can follow
  without a migration of the key.
- D4: `billing.quota_exhausted` is an `Err` extended with `usage` (the state at refusal), so the app
  can show the reset date without a second read.
- D6: the plan in force is the earliest period grant that has not ended (impl review #4), so a plan
  bought during the trial is known before its period starts.
- D5: minor bump at release time (new API, new table), entry under `## Unreleased`.

## Progress

- [x] 1 limits in the config and their resolution (652ba05)
- [x] 2 usage ledger (891e8ad)
- [x] 3 docs (e2c59d9); gates: typecheck, lint, build, npm test (7058 passed, 120 skipped; billing's Postgres race tests run against a local postgres 16)
