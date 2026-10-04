# Research: billing-guard-race-tests

Questions: (1) how a unit test calls billing's `/next` server actions and `requireWriteAccess` with
a given session; (2) where the two-connection race tests get their Postgres, and how they are made
to fail when a lock is dropped; (3) what a misspelt `adminRole` does today and where a setup check
can catch it earlier; (4) how the e2e reaches a paid period that ended.

## Sources

- Retro plan reviews: MO-1 W3, S1, S2 (`context/archive/2026-10-03-billing-entitlements/reviews/plan-review.md`),
  MO-2 W2, W3, S5 (`context/archive/2026-10-03-billing-plans-pricing/reviews/plan-review.md`).
- Code: `modules/billing/src/next/actions.ts`, `src/next/current-entitlement.ts`, `src/next/context.ts`,
  `src/server/entitlements.ts:94-145` (`changeEntitlement`), `src/server/grants.ts:41-91`
  (`grantPlanManually`), `src/server/setup.ts`, `src/server/health.ts`;
  `modules/auth/src/next/current-user.ts` (`requireUser`, `authorizeRole`), `modules/auth/src/server/roles.ts:28-36`
  (`assertDeclaredRole`); `foundation/db/src/client.ts` (`createDatabase`, pool), `foundation/db/tests/support/postgres.ts`;
  `.github/workflows/ci.yml:34-67` (the `test` job's `postgres:16` service and `SOFTURE_TEST_POSTGRES_URL`).
- Precedents for request-scope mocks: `modules/auth/tests/role-checks.test.ts`,
  `modules/waitlist/tests/next-confirm.test.tsx`, `modules/mailing/tests/next-unsubscribe.test.tsx`.

## Findings

1. **Session mocks have a house pattern.** auth and waitlist mock `@softure-ai/core/next`
   (`getSoftureConfig`), `next/headers` (`cookies()` returning the session cookie the test sets),
   `next/navigation` (`redirect` / `notFound` throwing a signal) and the adapter's context module.
   Billing's actions also call auth's `requireUser` / `authorizeRole`, which open auth's own
   context through `getSharedDatabase`; mocking `getSharedDatabase` in `@softure-ai/db` hands both
   contexts the PGlite test database in one place. `next/cache` (`revalidatePath`) needs a stub
   outside a Next request. A real session comes from `registerUser` (it returns the token), a role
   from `grantRole` or `auth({ adminEmails })`.
2. **The CI Postgres is already there.** The `test` job runs a `postgres:16` service and exports
   `SOFTURE_TEST_POSTGRES_URL` for `@softure-ai/db`'s driver tests, which create a database per test
   and drop it. Billing's tests can do the same with `createDatabase` and `migrate` from
   `@softure-ai/db` (no new dependency); the e2e database belongs to the built app and its
   Playwright run, so it is the wrong place. Without the variable the tests skip locally; a guard
   test fails in CI when it is missing (as `foundation/db/tests/postgres-env.test.ts` does).
3. **Two connections are not enough: the order must be forced.** With `Promise.all` alone the first
   transaction often commits before the second reads, so the second takes the plain path and the
   insert-conflict branch never runs. A third "blocker" connection fixes the order:
   - First insert: the blocker inserts the account's row and keeps its transaction open. Both
     changes see no row (uncommitted), take the insert branch and wait on the key; once the blocker
     commits, both hit the conflict, re-lock the row and apply on top, one after the other.
   - Concurrent grants: the blocker locks the existing row `FOR UPDATE`; both grants queue on it.
   The test waits until `pg_stat_activity` shows two sessions waiting on a lock, then commits.
   Measured: the run takes about 0.3 s per test on local Postgres 16.
4. **The tests bite.** Without the re-lock (`FOR UPDATE`) both waiters read the same row and the
   second update overwrites the first: one month instead of two. Without the entitlement lock in
   `grantPlanManually` the same lost update happens. (Checked by mutation in the implementation.)
5. **A real race the old tests could not see.** Spike: two lifetime grants by hand, at once, on an
   account whose row does not exist yet (the blocker inserts it). Both pass the
   `billing.lifetime_active` check, because `lockEntitlementRow` locks nothing while there is no
   row, and both succeed: two active manual lifetime grants. The same gap lets a period grant land
   on top of a lifetime granted at the same moment. Not fixed here (owner rule: gaps go to the
   followups roadmap); filed as a new FU item with this reproduction.
6. **A misspelt `adminRole` is loud already, but late.** `authorizeRole` and `requireRole` call
   `assertDeclaredRole` (`modules/auth/src/server/roles.ts:31`), which throws for an undeclared role.
   So the retro's "silently locking every admin out" is stale; what remains is that the mistake
   shows only when an admin opens `/admin/billing` or submits an admin form, as a 500, and the
   message names auth, not billing's option. A check next to `assertPaymentSetup` can run on every
   billing request (`getBillingContext`, used by every page, guard, action and route) and in the
   readiness probe (`checkBillingTables`; ops logs a throwing check as failed, so a deploy's health
   check fails before traffic). `isDeclaredRole` is exported from `@softure-ai/auth/server`.
7. **Paid period that ended in the e2e.** The e2e already writes a past `trial_ends_at` straight
   into `billing.entitlements` (`endTrial`); a paid period that ended is the same row with a
   `paid_until` a minute ago. The notice then says `notice.paidEnded`, and a write is refused.

## Options

| Question | Option | Verdict |
| --- | --- | --- |
| Session | Mock `getSharedDatabase` plus `cookies()` (finding 1) | chosen: real auth code runs, only the request scope is faked |
| Session | Mock `requireUser` / `authorizeRole` | rejected: would test the mock, not the guard order |
| Postgres | CI service through `SOFTURE_TEST_POSTGRES_URL` | chosen |
| Postgres | The e2e database | rejected: another process's schema and lifetime |
| Order | Blocker connection plus `pg_stat_activity` wait | chosen: deterministic |
| Order | Repeat `Promise.all` N times | rejected: can pass by luck |
| adminRole | Check in `getBillingContext` and the health check | chosen |
| adminRole | Check in the options schema | impossible: a module's options cannot see auth's |

## Not gaps

- `startPaymentAction` reads no role: any signed-in account may pay; its guard is the session.
- `requireWriteAccess`'s null branch (a session whose account is gone) cannot be reached with a real
  session: sessions are deleted with their account (`ON DELETE CASCADE`). The tests cover the
  refusal through a read-only account instead (S1's "unknown account" case asked for the same
  `billing.read_only` answer).
