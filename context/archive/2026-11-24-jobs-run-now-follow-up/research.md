# Research: jobs-run-now-follow-up

## Findings
- `modules/jobs/src/server/schedules.ts`: `runScheduleNow` and the tick (`enqueueScheduledRun`) both call `enqueueJob`
  with `SCHEDULE_DEDUP_KEY` (`schedule`).
- `modules/jobs/src/server/enqueue.ts`: insert `on conflict do nothing` on (queue, dedup_key) where the status is
  `pending` or `running`, then a lookup of the live job; the result is `isDuplicate: true` whatever its status.
- The unique index `jobs_dedup_key_idx` covers live jobs only, so the same key can hold a running and a pending job
  only under two different keys.
- `retryJob` (admin) refuses with `jobs.dedup_key_taken` when the key is live; a retried schedule run keeps its key.
- The panel action (`src/next/actions.ts`) shows `run_joined` on `isDuplicate`, `run_enqueued` otherwise: unchanged.
- Existing tests: `tests/steering.test.ts` (runScheduleNow), `tests/schedules.test.ts` (tick joins a live run).
- Claims: `claimJobs` from `/server` turns a pending job into a running one in tests.

## Options
1. Alternate two keys inside schedules (chosen): no schema change, the index still bounds live runs per key.
2. `enqueueJob({ joinRunning: false })`: cannot insert behind a running job with the same key under the index.
3. No dedup key for manual runs: unbounded pile-up of runs.
