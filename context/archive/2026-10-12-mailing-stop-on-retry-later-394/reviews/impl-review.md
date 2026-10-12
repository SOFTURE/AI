# Implementation review: mailing-stop-on-retry-later-394

Reviewed the diff against change.md and plan.md on `b3d6daf`. Mode: autonomous (decisions taken, recorded here). Package
tests (545), typecheck and lint green.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | The CLI's "no outcome yet" exit lost its only test: the test that reached it through an unavailable provider now stops at the outage. | Fixed: a CLI test reaches it through a recipient another run holds (`in flight`). |
| F2 | Warning | The stop message ended "run the same command again once it is fixed", which reads wrong for an outage. | Fixed: it says "again later" for `mailing.unavailable`. |
| F3 | Suggestion | The recipient a run stops at still spends its attempt (`giveAttemptBack: false`), so an outage longer than `maxAttempts` runs rejects that one recipient. | Accepted: the issue asks for one attempt per run instead of one per recipient; giving the attempt back would let an outage retry forever. |
| F4 | Suggestion | The stop check sits in two runners. | Fixed: one `getRunHalt(outcome, stopOnRetryLater)` in `deliveries.ts` serves both. |

No finding blocks the change.
