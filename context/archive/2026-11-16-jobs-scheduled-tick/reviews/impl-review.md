# Implementation review: jobs-scheduled-tick

Verdict: approve. Checked the diff against `plan.md` and the change's constraints.

| # | Finding | Severity | Decision |
| --- | --- | --- | --- |
| 1 | Bumping jobs to 0.2.0 for a new entry would have broken the `dependsOn` range `^0.1.6` of alerts (a caret on 0.x pins the minor). | Critical | Fixed before commit: released as 0.1.11, like earlier feature releases of the package. |
| 2 | `listJobRuns` has no job filter; the first budget test passed `jobId`, which the type check rejected. | Warning | Fixed: the test filters by queue, where only the first job ran. |
| 3 | The Node loop shares the round's steps instead of calling `runJobsTick`, a drift from the roadmap wording. | Suggestion | Accepted (Decisions (auto) in the plan); the roadmap Outcome is reworded at archive. |
| 4 | Overlapping ticks: the schedule period and the hourly prune are taken with conditional upserts, claims with `SKIP LOCKED`; covered by the two-tick test. | — | No change. |
| 5 | A job past the budget is not released (that would hand back the attempt and loop); it is logged and keeps its lease. | — | No change; documented in the README and docs/07. |

Gates: typecheck, lint (with a larger heap: `eslint .` ran out of memory at the default), full `npm test`; the
Workers guard walks every newly declared entry (`tests/repo/workers-entries.test.ts`).
