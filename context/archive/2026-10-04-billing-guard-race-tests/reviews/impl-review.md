# Implementation review: billing-guard-race-tests

Reviewed: the branch diff (`modules/billing/{tests/next-guards.test.ts,tests/postgres.ts,tests/lock-races.test.ts,tests/setup.test.ts,tests/support.ts,src/server/setup.ts,src/server/health.ts,src/server/index.ts,src/next/context.ts,README.md}`,
`examples/next-app/e2e/billing-entitlements.spec.ts`, the FU-33 entry) against plan.md and the plan
review. Verdict: **approved**, no open findings.

## Plan conformance

| Step | Result |
| --- | --- |
| Phase 1, steps 1-2: guards | Done in one file, `tests/next-guards.test.ts` (one set of request-scope mocks; plan updated). Every admin action as anonymous, member and admin: refusals are exactly `{ status: "error", error: "auth.forbidden" }` (no echo, so the form was not read), nothing written, no revalidation; the admin's change lands and refreshes `/admin/billing`. `startPaymentAction`: login redirect with `next=/payment`, a member's request stored. `requireWriteAccess`: redirect (with and without `next`), trial `Ok`, read-only `billing.read_only`. |
| Phase 1, step 3: Postgres | `tests/postgres.ts` (database per test on `SOFTURE_TEST_POSTGRES_URL`, migrated, dropped; `openBlocker`; `waitForLockWaiters` filtered by database, plan review W2). `tests/lock-races.test.ts`: forced first-insert race, plain two-change race, forced concurrent `grantPlanManually` with both recorded periods; CI guard. |
| Phase 1, step 4: mutations | See "Tests that bite". |
| Phase 2, steps 1-2: role check | `assertAdminRoleDeclared` (cached per config) in `setup.ts`, exported from `/server`; first line of `getBillingContext` (before the database opens) and of `checkBillingTables`. Test-first: four tests were red before the code. |
| Phase 2, step 3: e2e | `endPaidPeriod` (trial ended a month ago, paid period a minute ago): read-only badge, `notice.paidEnded`, renew link to `/payment`, write refused, nothing stored. |
| Phase 2, step 4: gap | FU-33 `billing-lifetime-grant-race` filed (roadmap row, block, lane C after FU-32, owner table, backlog entry). |

## Checks

| Check | Result |
| --- | --- |
| Tests that bite (plan review W1) | Dropping `FOR UPDATE` in `lockStoredRecord` fails the forced first-insert test; returning after an empty `ON CONFLICT` insert without re-applying fails it too; dropping both entitlement locks (`lockStoredRecord` and `lockEntitlementRow`) fails the concurrent-grants test (one month lost). Dropping only `lockEntitlementRow` passes, correctly: `changeEntitlement` still serialises the grants. Removing the role check in `grantPlanAction` fails its three tests; removing the `read_only` branch of `requireWriteAccess` fails its test. |
| Determinism | The blocker holds the contested lock until `pg_stat_activity` shows both changes waiting; a change that takes no lock never waits, so the bounded wait (10 s) fails instead of passing by luck. About 0.3 s per test locally. |
| Time | The guard tests pin `Date` (fake timers, Date only) to the suite's instant, so `systemClock` in auth's and billing's contexts agrees with the test clock that created the sessions; nothing depends on the day the suite runs. |
| Setup check | The default `admin` is always declared (`getDeclaredRoles`); a custom declared role passes; the message names `billing({ adminRole })`, the value and the declared roles. Tests that mock `getBillingContext` are unaffected. |
| Scope | No production behaviour changed except the new setup failure. The lifetime race is filed, not fixed (plan review S1). |
| Gates | `npm run typecheck`, `npm run lint`, `npm test` (with `SOFTURE_TEST_POSTGRES_URL` set, as CI), `npm run build`; e2e `billing-entitlements`, `billing-pricing`, `ops` on the built example app (17 passed). |

## Findings

None open. One local run of the billing tests, made while the example app was building in parallel,
timed out a `beforeEach` (Vitest's 10 s hook default) in `next-guards.test.ts`; alone and on the
next full run it passed (about 1 s per test). Noted in case a loaded CI runner shows the same.
