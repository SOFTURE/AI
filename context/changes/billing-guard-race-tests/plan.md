# Plan: billing-guard-race-tests

Input: change.md, research.md. Complexity: small (tests, one setup check).

## Goal

- Every billing server action (`startPaymentAction`, `grantPlanAction`, `grantRequestAction`,
  `dismissRequestAction`, `revokeGrantAction`, `findAccountAction`) and `requireWriteAccess` are
  called in a unit test as an anonymous visitor, a member and an admin, with the real auth code and
  a faked request scope: anonymous → login redirect (payment, write guard) or `auth.forbidden`
  (admin actions), member → `auth.forbidden` on admin actions, admin → the change happens. The form
  is not read before the check (a refused action writes nothing).
- `requireWriteAccess`: trial → `Ok`, read-only → `billing.read_only`, no session → redirect.
- On Postgres, with the order forced by a blocker connection: two first changes that both meet a
  row inserted by another transaction both apply; two plan grants by hand at once add two periods.
  A guard test fails in CI when `SOFTURE_TEST_POSTGRES_URL` is missing.
- `billing({ adminRole: "admn" })` with `auth({ roles })` not declaring it throws at the first
  billing request (`getBillingContext`) and fails the readiness probe, naming `billing({ adminRole })`
  and the declared roles.
- The e2e covers an account whose paid period ended: badge read-only, `notice.paidEnded`, the write
  refused.

**Out of scope:** fixing the lifetime-grant race the spike found (research finding 5; a new FU item);
other lane C items (FU-27 and later); the Stripe route and webhook (covered by their own tests).

## Approach

**Starting point:** no test calls `src/next/actions.ts` or `src/next/current-entitlement.ts`; the
only race tests run on PGlite (`tests/entitlements.test.ts:195`, `tests/payments.test.ts:48-53`);
`assertPaymentSetup` (`src/server/setup.ts`) is the setup-check precedent.

**Chosen:** research options: mock `getSharedDatabase` and `cookies()` (finding 1); the CI service
through `SOFTURE_TEST_POSTGRES_URL` with a database per test (finding 2); a blocker connection and a
`pg_stat_activity` wait (finding 3); the role check in `getBillingContext` and `checkBillingTables`
(finding 6).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Request scope | `vi.mock` of `@softure-ai/core/next`, `@softure-ai/db` (`getSharedDatabase` only), `next/headers`, `next/navigation`, `next/cache` | real auth and billing code runs | research 1 |
| Postgres support | `tests/postgres.ts`: create, migrate, drop; `openBlocker`; `waitForLockWaiters` (10 s, then fails) | a dropped lock means nobody waits: the wait times out and the test fails | research 3 |
| Skip rule | skip without the variable; an `it.runIf(CI)` guard asserts it | as `@softure-ai/db` does | research 2 |
| Role check | `assertAdminRoleDeclared(config)` in `setup.ts`, cached per config like `assertPaymentSetup` | one clear message, once | research 6 |
| Unreachable branch | `requireWriteAccess` null entitlement stays argued | sessions die with the account | research "Not gaps" |

## Phase 1: Guards and locks

**Discipline:** test-after (tests of existing behaviour), each new test checked to fail by a
temporary mutation of the code it guards. **Files:** `tests/actions.test.ts` (new),
`tests/write-access.test.ts` (new), `tests/postgres.ts` (new), `tests/lock-races.test.ts` (new),
`tests/support.ts` (a `createAccount` that takes any context).

1. `tests/actions.test.ts`: request-scope mocks; per admin action: anonymous and member get
   `auth.forbidden` and nothing is written (row counts / entitlement unchanged), admin gets the
   change (grant recorded, request closed, grant revoked, redirect to the account history).
   `startPaymentAction`: anonymous → redirect to login with `next=/payment`, member → `requested`
   and a stored request.
2. `tests/write-access.test.ts`: `requireWriteAccess` with no session (redirect), a trial (`Ok`
   with user and entitlement), a read-only account (`billing.read_only`).
3. `tests/postgres.ts` and `tests/lock-races.test.ts`: the first-insert race (blocker inserts the
   row), a plain two-change race, concurrent `grantPlanManually` (blocker holds the row); the CI
   guard.
4. Mutation check (not committed): drop the re-lock in `changeEntitlement` and the entitlement lock
   in `grantPlanManually`; the matching Postgres test fails. Drop the role check in one admin
   action; its test fails.

## Phase 2: Admin role check and e2e

**Discipline:** TDD for the check. **Files:** `src/server/setup.ts`, `src/next/context.ts`,
`src/server/health.ts`, `tests/setup.test.ts` (new) or `tests/module.test.ts`,
`examples/next-app/e2e/billing-entitlements.spec.ts`, `README.md` (one line on the check).

1. Test first: a config with `adminRole: "admn"` makes `checkBillingTables` reject and
   `assertAdminRoleDeclared` throw with `billing({ adminRole })` and the declared roles in the
   message; the default `admin` and a declared custom role pass.
2. `setup.ts`: `assertAdminRoleDeclared(config)` with `isDeclaredRole` from `@softure-ai/auth/server`;
   called from `getBillingContext` and `checkBillingTables`.
3. e2e: `endPaidPeriod(email)` writes a `paid_until` a minute ago (trial long over); the badge says
   read-only, the notice `paidEnded`, the write is refused and stores nothing.
4. File the lifetime-grant race as a new FU item (first free number on fresh `master`).

## Risks and rollback

- A slow CI runner: the lock wait is bounded (10 s) and polls every 20 ms; the measured run is
  about 0.3 s per test.
- Rollback: revert the commits; no migration, no stored data.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Guards and locks

#### Automated
- [ ] 1.1 Every admin action refuses anonymous and member callers with `auth.forbidden` and writes nothing; admin succeeds
- [ ] 1.2 `startPaymentAction` sends an anonymous visitor to login and takes a member's request
- [ ] 1.3 `requireWriteAccess`: redirect, `Ok`, `billing.read_only`
- [ ] 1.4 First-insert race and concurrent manual grants pass on Postgres with a forced order; CI guard present
- [ ] 1.5 Mutations of the guarded locks and checks fail the new tests (recorded in impl review)
- [ ] 1.6 Gates green (typecheck, lint, test, build)

### Phase 2: Admin role check and e2e

#### Automated
- [ ] 2.1 A misspelt `adminRole` throws at `getBillingContext` and fails the readiness probe, naming the option
- [ ] 2.2 The e2e covers a paid period that ended
- [ ] 2.3 The lifetime-grant race is filed as a new FU item
- [ ] 2.4 Gates green (typecheck, lint, test, build, e2e for the billing specs)
