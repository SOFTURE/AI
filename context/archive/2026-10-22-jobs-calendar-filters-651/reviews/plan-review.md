---
change_id: jobs-calendar-filters-651
reviewed: 2026-10-22
verdict: approved
---

# Plan review: jobs-calendar-filters-651

Checked plan.md against change.md, research.md, issue #651, `options.ts`, `schedules.ts` and `run-job-worker.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | The worker skips slots equal to or older than the one it settled; a filtered slot must stay monotonic in `now`. | Covered: the slot is the latest matching occurrence at or before `now`; plan step 1 walks the clock minute by minute. |
| 2 | Major | An unbounded date walk could loop forever on a filter that never matches. | Every combination matches eventually (research); the walk stops at 800 dates and the 609-day worst case is tested. |
| 3 | Minor | The new `isLate` rule also changes unfiltered `at` schedules with uneven times (stricter, follows the real gap). | Accepted (change.md Decisions); the CHANGELOG says so. |
| 4 | Check | `getQueueStats` runs per request; the forward walk is pure date arithmetic and two `getZonedInstant` calls per matching date. | No change. |
| 5 | Check | `JobScheduleOptions` keeps its shape for `every`; `LocalTimeScheduleOptions` gains optional fields, so packages that ship `{ every }` schedules still typecheck. | No change. |

No Critical findings.
