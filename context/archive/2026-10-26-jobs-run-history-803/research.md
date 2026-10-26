# Research: jobs run history (issue #803)

## Where an attempt ends today

- `modules/jobs/src/server/process.ts` `runClaimedJob` runs the handler and `decide`s a `Completion`; `isOk` only
  checks `ok === true`, the returned value is dropped.
- `modules/jobs/src/server/claim.ts` `completeJob` writes the outcome fenced by the claim token in one transaction
  (plus the schedule bookkeeping). Every attempt that ends with an outcome passes through it, the invalid-payload
  failure included. `failExhaustedLeases` is the one other terminal path (`jobs.lease_expired`, no handler result).
- `claimJobs` sets `updated_at = now` on claim, so `ClaimedJob.job.updatedAt` is the attempt's start; the lease
  extension writes the row, not the in-memory `job`.

## What starts a job

- `enqueueJob` (`server/enqueue.ts`) is the only writer of `jobs.jobs`; `enqueueScheduledRun` (worker's schedule tick)
  and `runScheduleNow` (admin Run now, app code) call it. Nothing records which.
- `retryJob` resets a failed or cancelled row in place; the row keeps whatever it had.

## Retention and pruning

- `retention` in `src/options.ts`: `succeededDays` 7, `failedDays` 30, `cancelledDays` 7, `syncItemsDays` 90.
- The worker (`worker/run-job-worker.ts`) prunes hourly with `pruneJobs` and `pruneSyncItems`; an app without a
  worker calls them from a cron (README "Without a worker").

## Admin page

- `next/pages.tsx` reads `getQueueStats`, `listRecentJobs` (failed, cancelled, retrying) and `listSyncItems`, maps them
  with `next/panel-rows.ts` `toJobsPanelData` and renders `ui/jobs-panel.tsx` `JobsPanel`. Apps may compose
  `JobsPanel` themselves, so new props must be optional.
- Copy lives in `src/messages/en.ts`; `JobsMessages` is its type.

## Schema and migrations

- Migrations `0001`–`0005` in `modules/jobs/migrations/`, forward only with a rollback comment. Manifest `tables` in
  `src/index.ts` and `module.json` list the tables (`tests/module.test.ts` checks them against the database).

## Options considered

1. Summary and origin on `jobs.jobs`, with a longer retention for succeeded rows: mixes the queue with its history,
   loses every attempt but the last, and keeps payloads longer.
2. A `jobs.runs` table, one row per recorded attempt (job id, queue, origin, attempt, outcome, error code, summary,
   start, finish), with `origin` also on `jobs.jobs` so later attempts know it. Own retention, no payload.

Option 2 matches the issue ("per attempt", "separate retention") and keeps payloads out of the history.
