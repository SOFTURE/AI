# Plan review: billing-lifetime-grant-race

Reviewed: plan.md @ 2026-10-04. Mode: deep (money and locks). Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.
Grounding: 7/7 paths, 6/6 symbols (`grantPlanManually`, `grantPaymentRequest`, `lockEntitlementRow`,
`getDefaultRecord`, `applyPlan`, `changeEntitlement`) and 4/4 commands exist on 99c50bc
(`pinEntitlementRow` is new).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: the outcome (lock before the row exists, Postgres test) is items 1.1-1.2; both unknowns answered in research F3-F5 |
| Slicing | PASS: one phase; the pin and its tests are one change |
| Verifiability | WARN (W1) |
| Data and migrations | PASS: no migration; the pinned row holds what reads derive |
| Failure paths | WARN (W2) |
| Tests | PASS: two Postgres races, one PGlite refusal; each fails on `master` |
| Security | PASS: no new input; the actions' guards are unchanged |
| Lean | PASS (S1) |
| Fit | PASS: same insert-then-lock as `changeEntitlement`; lock order unchanged |
| Scope | PASS: FU-34, FU-35, `startPayment` out |
| Reuse | PASS: `getDefaultRecord`, FU-26's blocker and `waitForLockWaiters` |
| Lessons | PASS (FU-26: a lock test must fail when the lock is dropped, through the waiter count) |
| Progress format | PASS |

## Findings

### W1 [WARNING] The mixed race must be ordered, not left to the wake-up order
**Effort:** low. **Lens:** Verifiability. **Where:** plan Phase 1 step 1, second bullet
**Problem:** Two grants that both wait on a blocker's insert wake together; which one takes the
row first is up to Postgres. With a lifetime and a monthly grant, monthly first then lifetime is a
legitimate result (a lifetime on top of a period), so a test that releases both at once would
pass or fail by chance.
**Fix:** Keep the plan's shape: the lifetime grant is held after its pin (a blocker locks the
request row it closes), and only then the monthly grant starts, so the monthly grant is the one
that waits on the pinned row. Assert the waiter count (2) before release; without the pin only one
session waits and the wait times out, so the test fails on `master` for the right reason.
**Decision:** Fix in plan (already the plan's design; the step now names why).

### W2 [WARNING] Deleting a pinned row must not delete a row another change wrote
**Effort:** low. **Lens:** Failure paths. **Where:** plan Phase 1 step 3 · `src/server/grants.ts:60-68`
**Problem:** If the delete ran whenever `billing.request_closed` follows, it would delete a row that
existed before the grant (with paid days on it).
**Fix:** Delete only when `pinEntitlementRow` returned `true` (this transaction inserted the row);
the row is then uncommitted and locked by this transaction, so no one else has seen it, and a
grant waiting on its insert inserts its own after the commit. Covered by 1.3 (no row left) and the
existing request-closed tests on accounts with rows (their rows stay).
**Decision:** Fix in plan (Critical details already say so; the implementation checks the
boolean).

### S1 [SUGGESTION] The README states no lock order
**Effort:** trivial. **Lens:** Lean. **Where:** plan Phase 1 Files
**Problem:** `modules/billing/README.md` has no lock-order line to update (`grep "lock order"`).
**Fix:** Drop it from the files; the order is documented in the source comments it already names.
**Decision:** Accepted.
