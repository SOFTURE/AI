---
change_id: jobs-schedule-last-failure-603
---

# Research: last failure of a scheduled queue

## Current behaviour

- `modules/jobs/src/server/schedules.ts`: `ScheduleState` = `everySeconds`, `lastEnqueuedAt`, `lastSucceededAt`,
  `isLate`. `recordScheduleSuccess` updates `jobs.schedules.last_succeeded_at` for any succeeded job of a scheduled
  queue (a run enqueued by hand too). `getScheduleStates` reads the rows for `getQueueStats`.
- `modules/jobs/src/server/claim.ts`: `completeJob` writes the terminal state and, for a success, calls
  `recordScheduleSuccess` in the same transaction. Terminal failures reach the table in two places: `completeJob` with
  `kind: "failed"` (retries used up, `failJob`, `jobs.invalid_payload`, a throw on the last attempt) and
  `failExhaustedLeases` (`jobs.lease_expired`, a bulk update per queue before claiming).
- `last_error` holds an error code (`toErrorCode` in `process.ts` trims a handler's code; throws become
  `jobs.handler_threw`). No error text reaches the table.
- `jobs.schedules` row exists once a worker took a slot (`enqueueScheduledRun`); before that `recordScheduleSuccess`
  is a no-op update, and stats report nulls.
- Finished jobs are pruned (`pruneJobs`, failed after `retention.failedDays`), so deriving the last failure from
  `jobs.jobs` would forget it; the schedule row is the durable place.

## Options

1. New columns on `jobs.schedules`, set in the failing transaction. Durable, cheap to read. Chosen.
2. Query `max(finished_at)` of failed jobs per queue in `getQueueStats`. No migration, but loses history to pruning and
   needs a second query for the code.

## Risks

- `failExhaustedLeases` updates many jobs at once: record the latest per queue (one schedule update with its `now` and
  `jobs.lease_expired`) only when at least one row was failed.
- Migration must be forward-only with a rollback note, like 0002.
