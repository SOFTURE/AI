# Plan review: billing-guard-race-tests

Reviewed: plan.md @ 2026-10-04. Mode: standard (tests and one setup check; no data change).
Verdict: ready after fixes. Findings: 0 critical, 2 warning, 2 suggestion.
Grounding: 9/9 paths, 7/7 symbols (`changeEntitlement`, `grantPlanManually`, `lockEntitlementRow`,
`requireWriteAccess`, `assertPaymentSetup`, `checkBillingTables`, `isDeclaredRole`), 4/4 commands
(`npm run typecheck|lint|test|build`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: MO-1 W3, S1, S2 and MO-2 W2, W3, S5 each map to a Progress item; S5's "silent" baseline corrected by research 6 |
| Slicing | PASS: phase 1 tests only, phase 2 the one code change and the e2e |
| Verifiability | WARN (W1) |
| Data and migrations | PASS: none |
| Tests | WARN (W2) |
| Security | PASS: the check only adds a failure for a broken config; no new input |
| Lean | PASS |
| Fit | PASS: `tests/postgres.ts` mirrors `foundation/db/tests/support/postgres.ts`; mocks follow auth and waitlist |
| Cost and defaults | PASS: default `adminRole: "admin"` is always declared (`getDeclaredRoles` adds it) |
| Scope | S1 |
| Reuse | PASS: `createDatabase`, `migrate`, `registerUser`, `grantRole` |
| Lessons | PASS (none applies) |
| Progress format | PASS |

## Findings

### W1 [WARNING] A test that cannot fail proves nothing; say how each one was seen failing
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 1, step 4
**Problem:** The source findings exist because the old race tests passed whatever the code did.
Without a recorded mutation run the new ones could repeat that.
**Fix:** Item 1.5 records each mutation and the failing test in the implementation review.
**Decision:** Fix now (applied) - item 1.5.

### W2 [WARNING] The lock wait must not count other databases' sessions
**Effort:** low. **Lens:** Tests. **Where:** Phase 1, step 3 · `tests/postgres.ts`
**Problem:** Vitest runs files in parallel workers against one Postgres server; a waiter count over
the whole server could be satisfied by another file's sessions and release the blocker too early.
**Fix:** `pg_stat_activity` filtered by `datname = current_database()`; each test has its own database.
**Decision:** Fix now (applied) - the support file filters by database.

### S1 [SUGGESTION] Keep the lifetime race out of this change
**Effort:** low. **Lens:** Scope. **Where:** research finding 5
**Problem:** The fix (lock the account row, or insert the row before the check) changes
`grantPlanManually`'s locking, which FU-27 and FU-30 also touch.
**Fix:** File it as a new FU item with the reproduction; no `it.fails` or skipped test in this change.
**Decision:** Fix now (applied) - item 2.3; owner rule 2026-10-03 (gaps go to followups).

### S2 [SUGGESTION] The readiness probe log shows only the error's label
**Effort:** low. **Lens:** Fit. **Where:** Phase 2, step 2 · `modules/ops/src/server/health.ts:96`
**Problem:** ops logs `errorLogLabel(error)`, so the probe says "failed" without billing's message.
**Fix:** Accept: the probe still fails the deploy, and the first billing request logs the full
message. Changing ops' logging is out of lane.
**Decision:** Accept.

## Summary

Fixed: W1, W2, S1. Accepted: S2. Deferred: -. Dismissed: -.
Verdict after triage: ready.

## Decisions (auto)
- Mock `getSharedDatabase` rather than auth's guards, so the guard order is the real one.
- Role check in `getBillingContext` and the probe, not at option parsing (a module cannot see auth's options there).
