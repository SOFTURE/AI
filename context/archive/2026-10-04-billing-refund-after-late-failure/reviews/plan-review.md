# Plan review: billing-refund-after-late-failure

Reviewed: plan.md @ 2026-10-04. Mode: standard (money-adjacent: access follows refunds, no money
moves). Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.
Grounding: 6/6 paths (the migration is new), 4/4 symbols (`refundPayment`, `failRefund`,
`getFailedAmountCounted`, `takeBackGrant`) and 4/4 commands exist on 0123ea2
(`applyChargeState`, `keepNewerChargeState` are new).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: the outcome (kept state applied by the failure, once; signed fixtures) is 1.1 and 1.4; both unknowns answered in research F2, F5 |
| Slicing | PASS: one phase; the columns, the keep and the apply cannot land apart |
| Verifiability | PASS: 1.1 and 1.2 fail on `master` (nothing taken back) |
| Data and migrations | PASS: two nullable columns with a shape CHECK; rows from before have no kept state |
| Failure paths | WARN (W2) |
| Tests | PASS: FU-30's stale, repeated and uncounted cases stay in `tests/failed-refunds.test.ts` |
| Security | PASS: no new input; the signature check is unchanged |
| Lean | PASS: no Stripe client, no new option |
| Fit | PASS: the same locks and clock as FU-30 |
| Scope | PASS: refunds before checkouts and Stripe reads out |
| Reuse | PASS: `refundPayment`'s body becomes the shared function; fixtures from `tests/stripe-fixtures.ts` |
| Lessons | PASS (FU-26: a guard's test must fail without it; dropping the keep or the apply fails 1.1) |
| Progress format | WARN (W1) |

## Findings

### W1 [WARNING] The outcome of a kept state and the README's webhook table
**Effort:** trivial. **Lens:** Progress format / Docs. **Where:** plan Phase 1 step 3 · README §4 table
**Problem:** The plan does not say what `refundPayment` answers when it keeps a state, and the
README's `charge.refunded` row says a total not above the stored one "changes nothing", which is no
longer the whole story.
**Fix:** Answer `duplicate` (access does not change, the delivery is acknowledged) and say in the
row that a newer such state is kept for a late failure.
**Decision:** Fix in plan (step 3 names the row).

### W2 [WARNING] The kept refund's days are counted at the failure's delivery
**Effort:** trivial. **Lens:** Failure paths. **Where:** plan Key decisions, "Applying in `failRefund`"
**Problem:** `takeBackGrant` measures unused days at `now`, the failure's delivery, not at the kept
state's time, so days used in between are not counted.
**Fix:** None in code: it is what a late `charge.refunded` delivery does today; name it in the
README limitation that replaces the FU-35 one.
**Decision:** Fix in plan (README §12 note).

### S1 [SUGGESTION] A kept state under `keep_access`
**Effort:** low. **Lens:** Tests. **Where:** plan Phase 1 step 1
**Problem:** Under `keep_access` the applied kept state takes nothing back; no test shows it.
**Fix:** None now: the share comes from `getPartialShare`, the same call as a direct delivery,
which `tests/partial-refunds.test.ts` covers.
**Decision:** Accepted as is.
