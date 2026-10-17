---
change_id: jobs-local-time-schedules-554
reviewed: 2026-10-17
verdict: approved
---

# Plan review: jobs-local-time-schedules-554

Checked plan.md against change.md, research.md, issue #554, `options.ts`, `schedules.ts` and `run-job-worker.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | The worker caches the last settled slot per schedule and skips equal or older ones; an `at` slot must never move backwards for an advancing clock. | Covered: the slot is the latest occurrence at or before `now`, monotonic in `now`. A test walks the clock across the DST change. |
| 2 | Minor | A worker starting for the first time after 09:00 enqueues the 09:00 run late, as a period schedule enqueues its current period. | Keep it, same as periods ("missed slots collapse into one run"); the README says so. |
| 3 | Check | `JobScheduleOptions` becomes a union; the packages that ship schedules only write `{ every }`, typecheck covers them. | No change. |
| 4 | Check | No migration: `last_slot_at` stores any instant. | No change. |

No Critical findings.
