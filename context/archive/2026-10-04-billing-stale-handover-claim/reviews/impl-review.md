# Implementation review: billing-stale-handover-claim

Reviewed: 5d5b655 on `claude/project-thread-fo2e3z` against plan.md and change.md. Mode: standard
(one table, no money moves). Verdict: ready.
Findings: 0 critical, 0 warning, 3 suggestion (all accepted).

## Verdict

Every Done-when criterion is met and checked: gates green (typecheck, lint with the language gate,
2733 tests, build). The cut-off test and the re-claim test failed on `master` (one hand-over where
two were expected) and pass after the fix.

## Dimensions

| Dimension | Result |
| --- | --- |
| Plan coverage | PASS: phase 1 complete; plan review W1, W2 applied (migration header, README column table and §12 note) |
| Correctness | PASS: claim needs `handed_over_at IS NULL` and no claim or one at least a minute old; `confirmHandOver` after an `Ok` `requested`; release clears only its own claim |
| Concurrency | PASS: the claim is one conditional `UPDATE`; under READ COMMITTED a second ask re-checks the row after the first commits and sees a fresh claim, so two asks at once still claim once (existing test "hands over once when two asks run at once") |
| Data | PASS: `0008` adds one nullable column; rows from before keep `handed_over_at` and count as handed over; rollback in the header |
| Failure paths | PASS: `Err` and throw release; a failed confirm write propagates and leaves the claim, documented as at least once |
| Security | PASS: no new input; the buyer's action and rate limit are unchanged |
| Tests | PASS: three new PGlite tests (cut-off then take-over at 59 s / 60 s, no repeat after an answer, late `Ok` after a re-claim with the second ask failing) |
| Conventions | PASS: English only; clock from `ctx`; the timeout is a module constant, not exported |
| Docs | PASS: README invoice-requests paragraph, column table, migrations list, §12; header comments of `requests.ts` and `startPayment` |

## Plan coverage

| Goal | Evidence |
| --- | --- |
| A claim left without an answer is handed over by an ask a minute later | `tests/payments.test.ts` "hands a request over again on an ask a minute after a hand-over that never answered" |
| A confirmed hand-over is never repeated | "never hands a request over again once a hand-over answered, however late the ask"; "hands an open request over once" |
| A late `Ok` after a re-claim counts, and a failed re-claim does not undo it | "counts a hand-over that answers after another ask took over its claim, and hands over nothing more" |

**Mutations (not committed):** dropping `confirmHandOver` fails four tests, including the
once-only tests (every claim then expires and repeats).

## Findings

### S1 [SUGGESTION] Clocks of several app instances
**Where:** `src/server/requests.ts` (`claimHandOver`)
**Problem:** the claim time and the cutoff come from each instance's clock; an instance whose
clock runs a minute ahead could take over a live claim.
**Decision:** Accepted as is: the cost is a second mail to the owner, the lesser failure; the
whole billing module reads time from `ctx.clock` the same way.

### S2 [SUGGESTION] An ask within the minute after a cut-off answers "sent"
**Where:** `src/server/plans.ts` (`startPayment`)
**Decision:** Accepted and documented in README §12: the window is what keeps two asks at once
from both mailing; the next ask after it hands over.

### S3 [SUGGESTION] The example app's e2e was not run locally
**Where:** `examples/next-app/e2e/migrations.spec.ts`, `billing-*.spec.ts`
**Decision:** Accepted: the ledger line follows the migration file's name; CI's e2e job runs the
migration list and the manual request flow on the PR.
