# Plan review: billing-stale-handover-claim

Reviewed: plan.md @ 2026-10-04. Mode: standard (one table, no money moves). Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.
Grounding: 7/7 paths (the migration is new), 4/4 symbols (`claimHandOver`, `releaseHandOver`,
`startPayment`, `recordPaymentRequest`) and 4/4 commands exist on d36276f (`confirmHandOver` is new).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: the outcome (a claim left behind is claimed again; unit test) is 1.1; both unknowns answered in research F3, F5, F6 |
| Slicing | PASS: one phase; the column split and its call sites cannot land apart |
| Verifiability | PASS: 1.1 fails on `master`, 1.2 fails if only the timeout were added |
| Data and migrations | WARN (W1) |
| Failure paths | WARN (W2) |
| Tests | PASS: the existing once-only, concurrency and release tests keep guarding FU-27's behaviour |
| Security | PASS: no new input; the buyer's action is unchanged |
| Lean | PASS (S1) |
| Fit | PASS: conditional updates on the row, clock from `ctx`, like FU-27 |
| Scope | PASS: FU-35, expiry and Stripe out |
| Reuse | PASS: `createRecorder` and the test clock in `tests/payments.test.ts` |
| Lessons | PASS (FU-26: a guard's test must fail when the guard is dropped; 1.2 fails without the confirm) |
| Progress format | PASS |

## Findings

### W1 [WARNING] The migration must say what older values mean
**Effort:** trivial. **Lens:** Data and migrations. **Where:** plan Phase 1 step 2
**Problem:** After `0008`, `handed_over_at` changes meaning (claim → success). Rows written by
`0006`'s code hold a claim time there, which the new code reads as success; a claim left behind
before the migration stays unrecoverable.
**Fix:** Say so in the migration header and the README column table; the rollback notes that the
old code reads the column as a claim again, which is safe (no repeat hand-over).
**Decision:** Fix in plan (step 2 and step 3 name it).

### W2 [WARNING] A failed confirm write after a sent mail
**Effort:** trivial. **Lens:** Failure paths. **Where:** plan Phase 1 step 2 · `src/server/plans.ts:137`
**Problem:** If `confirmHandOver` throws (database down) after `onRequest` answered `Ok`, the claim
stays; after the minute the next ask hands over again, a second mail.
**Fix:** Let the database error propagate (the buyer sees an unexpected failure, as for any other
database error in `startPayment`) and name this case in the README's at-least-once note; no
release on that path (releasing would hand over again at once).
**Decision:** Fix in plan (README note).

### S1 [SUGGESTION] The bound as an option
**Effort:** low. **Lens:** Lean. **Where:** plan Key decisions, "Bound"
**Problem:** `requests.handOverTimeoutSeconds` would let a deployer with a slow `onRequest` widen it.
**Fix:** None now: a module constant; an option can be added when someone needs it.
**Decision:** Accepted as is.
