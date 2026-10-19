---
change_id: jobs-schedule-last-failure-603
reviewed: 2026-10-19
verdict: approved
---

# Plan review: jobs-schedule-last-failure-603

Checked plan.md against change.md, research.md, issue #603, `schedules.ts`, `claim.ts`, `process.ts` and
`maintenance.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | `failExhaustedLeases` runs outside a transaction; recording the failure separately could leave the job failed without the schedule noting it. | Wrap the bulk update and the schedule write in one transaction. |
| 2 | Minor | Equal timestamps (a success and a failure in the same millisecond, e.g. a test clock) must not read as failing. | Strict `>` per the issue; a test covers the order by advancing the clock. |
| 3 | Minor | A queue failing before any worker took a slot has no schedule row, so the failure is not recorded. | Same as successes today; a scheduled queue's row exists once its first run was enqueued by a worker. Note it in the README. |
| 4 | Check | `getQueueStats` callers that compare `schedule` with `toEqual` (tests, apps) see three more fields. | Additive; the CHANGELOG says so. |

No Critical findings.
