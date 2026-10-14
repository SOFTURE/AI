# Research: billing-usage-limits

## 1. Where the plan of paid access lives

- `billing.entitlements` holds `trial_ends_at`, `paid_until`, `is_lifetime`: no plan.
- Every grant is recorded with its plan and what it added: `billing.payments` (`plan_id`, `status`
  `paid | refunded`, `grant_kind`, `granted_from`, `granted_until`) and `billing.manual_grants`
  (`plan_id`, `status active | revoked`, same grant columns).
- Take-backs keep those dates true (`server/take-back.ts`): a refund or revoke shortens its own
  period and moves every later period back by the same days, in both tables. So the grant whose
  `[granted_from, granted_until)` contains `now` is the plan paying for today; a lifetime grant that is
  still paid (payment `paid`) or active (manual grant) wins.
- Paid access without a grant row exists: `importEntitlement` and `grant { until }` applied by hand.
  Its plan is unknown, so a fallback for paid access is needed (`paid.limits`).

## 2. Calendar months in the app's zone

- `calendar.ts`: `getStartOfDay(dayNumber, timezone)`, `parseDay`; core: `toCalendarDay`,
  `addCalendarMonths`. The month of `now` is `[start of day YYYY-MM-01, start of day of the next 1st)`
  in `config.timezone`, DST-safe through `getStartOfDay`.

## 3. Atomic "check and consume" in Postgres

- `INSERT ... ON CONFLICT (key) DO UPDATE SET used = usage.used + EXCLUDED.used WHERE usage.used +
  EXCLUDED.used <= $limit RETURNING used`: under READ COMMITTED the conflicting row is locked and the
  `WHERE` is evaluated on its latest committed version, so two concurrent consumers serialise on the
  row and the sum never passes the limit. No row returned means the update was refused.
- The first insert of a period races too: the second insert waits for the first and then takes the
  update path. A first consumption larger than the limit is refused before the statement.
- Called with a transaction handle (`{ ...ctx, db: tx }`), Drizzle's `transaction` nests as a
  savepoint, so the quota row rolls back with the app's write.
- The existing pattern for "account cannot vanish under a change": `select ... from auth.users for key
  share` (`changeEntitlement`).

## 4. Package conventions touched

- Options: zod `strictObject`s with `.prefault({})` for nested groups (`options.ts`).
- Errors: `Err<E>` carries only a code (core `result.ts`); a richer refusal can extend it.
- Messages: `errors.billing.*` in `messages/en.ts`, looked up by `getBillingErrorMessage`.
- New table: migration `0011`, Drizzle view in `schema.ts`, manifest `tables` in `src/index.ts` and
  `module.json`, health probe, privacy export and delete, README §3/§5/§11, CHANGELOG `## Unreleased`.
- Tests: PGlite for behaviour (`tests/support.ts`); real Postgres for races (`tests/postgres.ts`,
  `SOFTURE_TEST_POSTGRES_URL`, required in CI).
