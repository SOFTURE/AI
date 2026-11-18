# Plan review: ci-usage-time-budget

Reviewed: plan.md against change.md, research.md and `tools/ci-usage/src/collect.ts`. Mode: autonomous.
Verdict: approve after the fix below (applied to plan.md).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | A budget input above the job timeout would bring the cancellation back. | Fixed: the workflow checks `max-minutes` as a whole number from 1 to 14. |
| 2 | Suggestion | Cached runs need no request and should not count against a batch. | Already planned: only runs that need a request are batched; cached runs are taken in order without waiting. |

The contracts hold: `CollectResult` and the JSON shape do not change; only a new partial reason text appears.
