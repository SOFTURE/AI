# Plan review: mailing-stop-on-retry-later-394

Reviewed plan.md against change.md, issue #394 and the package on master `0d3c6c1`. Mode: autonomous (decisions
taken, recorded here).

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | Widening `halted.reason` breaks an app that maps `HaltingErrorCode` exhaustively over `summary.halted.reason`. | Accepted: the new type is exported, and the CHANGELOG names it; the alternative (a second field) makes every caller check two places for "the run stopped early". |
| F2 | Warning | A default of `true` changes `sendCampaign` for an operator who relied on one 5xx not stopping the campaign. | Accepted: a re-run resumes where it stopped and sends nothing twice; the old behaviour stays one option away. |
| F3 | Suggestion | A single transient 5xx now ends a long run early. | Accepted: the next scheduled run continues; the summary says why it stopped. |

No finding blocks the plan.
