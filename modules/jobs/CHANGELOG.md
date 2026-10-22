# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/jobs`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## 0.1.4

- Sync state for jobs that poll a third-party source (#639): a cursor per source and a processed-item ledger, so a
  second run never acts twice on the same item, a failed item is retried a bounded number of times and an overview
  shows what passed, what failed and why. New in `@softure-ai/jobs/server`: `getSyncCursor`, `advanceSyncCursor`
  (compare-and-set; `jobs.sync_cursor_moved` when another run moved it first), `processSyncItem` (runs the callback in
  the item's transaction, so the app's writes commit with the ledger's `done`; returns `handled`, `retrying`, `failed`
  or `skipped`), `listSyncItems`, `pruneSyncItems`. New in `@softure-ai/jobs`: `skipSyncItem`, `failSyncItem`, the
  `SyncItem*` types, `SYNC_ITEM_STATUSES`, `jobSyncCursorsTable`, `jobSyncItemsTable`; in `@softure-ai/jobs/testing`:
  `listSyncState`. Error codes `jobs.sync_cursor_moved` and `jobs.sync_item_threw` with their `errors.*` copy.
- `retention.syncItemsDays` (default 90): ledger items no run met for that long are deleted by the worker's hourly
  prune (or `pruneSyncItems` from a cron).
- Migration for an app: run the module migrations (`0004_create_sync_state.sql` adds `jobs.sync_cursors` and
  `jobs.sync_items`). An app that keeps its own cursor and processed-items tables for a polling job can move to these
  (copy its rows into them, then drop its tables); nothing changes for an app that does not poll. Code or tests that
  compare the whole parsed `retention` option with `toEqual` see the new key.

## 0.1.3

- A health check of the worker's loop (#610): `runJobWorkerProcess({ healthFile })` (and `runJobWorker`) touches the
  file after each round whose claims reached the database, removes a stale one at start and its own after a clean
  stop; started with `--health`, the same entry checks the file instead of running (exit 0 when no older than
  `healthMaxAgeMs`, default five poll intervals and at least 30 s; 1 when missing or older, or without `healthFile`).
  New exports from `@softure-ai/jobs/worker`: `checkJobWorkerHealth`, `getJobWorkerHealthMaxAgeMs`, `JobWorkerHealth`.
  Off by default: an app that passes no `healthFile` sees no change.
- Migration for an app whose worker runs in Docker with a liveness check of PID 1 (`node -e "process.kill(1, 0)"`):
  after upgrading to this version, pass `healthFile: "/tmp/softure-jobs-worker.alive"` in `scripts/worker.ts` and set
  the worker service's `healthcheck.test` to `["CMD", "node", "worker.mjs", "--health"]` in the production compose
  file (and the integration one, if it has a worker). Do it in that order: an older worker does not know `--health`.
- `getQueueStats` reports a scheduled queue's last failure (#603): each `schedule` gains `lastFailedAt` (when a job of
  the queue last ended `failed`: attempts used up, `failJob`, an invalid payload or an expired lease with no attempts
  left; a retried attempt does not count), `lastFailureCode` (that job's error code, never an error's text) and
  `isFailing` (`lastFailedAt` later than `lastSucceededAt`, or a failure and no success yet). Stored in
  `jobs.schedules` in the same transaction as the failed job, so it outlives pruning; migration
  `0003_add_schedule_failures.sql` adds two nullable columns.
- Migration for an app: run the module migrations (`0003` adds the columns; failures before it are not back-filled).
  An app that kept a log of its own runs only to tell whether the latest run failed reads
  `stats.schedule.isFailing`, `lastFailedAt` and `lastFailureCode` from `getQueueStats` instead and can drop that log.
  Code or tests that compare a whole `schedule` with `toEqual` see the three new fields.

## 0.1.2

- Schedules at local times of day (#554): `schedules: { "<queue>": { at: ["09:00", "21:00"], timeZone: "Europe/Warsaw" } }`
  enqueues one run per listed local time, with the zone's offset on each date, so the run keeps its local time across
  DST changes (a skipped time runs just after the change, a repeated one once). The same "once per slot however many
  workers run" guarantee as periods, no migration. A schedule takes exactly one of `every` and `at`; `timeZone` is
  required with `at` and refused with `every`. Period schedules are unchanged. `getQueueStats` reports an `at`
  schedule's `everySeconds` as the longest gap between its times. New types `PeriodScheduleOptions` and
  `LocalTimeScheduleOptions`; `JobScheduleOptions` is their union, so code that read `schedule.every` checks
  `"every" in schedule` first.
- Migration for an app that runs a job at a local time from a host cron: add the schedule to `jobs({ schedules })`
  (to move billing's reminder mail: `"billing.access-reminders": { at: ["09:00", "21:00"], timeZone: "<zone>" }`
  after `...billingJobSchedules`, which replaces its daily UTC period), make sure the worker runs the queue's handler
  (`...billingJobHandlers` or `createBillingJobHandlers({ reminders })`), then remove the host cron entry (the deploy
  `maintain` hook) so the job does not run twice.

## 0.1.1

- Recurring schedules (#491): `jobs({ schedules: { "<queue>": { every: "1h", payload } } })`. Workers enqueue each
  period's run once, however many run (a conditional upsert of the new table `jobs.schedules`, migration
  `0002_create_schedules.sql`, in the same transaction as the job); missed periods collapse into one run; while a run
  is still live the next period joins it. A schedule's queue takes the default queue settings unless `queues` names
  it, and `queues` may be left out when schedules define them. `runDueJobs` enqueues due runs first;
  `enqueueDueSchedules` serves apps that drain from a cron. `getQueueStats` reports each queue's `schedule`
  (`everySeconds`, `lastEnqueuedAt`, `lastSucceededAt`, `isLate`). auth, mcp-access, waitlist, security and analytics
  ship their prune handlers and schedules in their `./jobs` entries.

## 0.1.0

- First version (#471): background jobs in Postgres (`jobs.jobs`). `jobs({ queues })` in `softure.config.ts`;
  `enqueueJob` inside the caller's transaction with an optional `dedupKey`; `cancelJob`, `retryJob`, `getJob`,
  `getQueueStats`, `pruneJobs`; handlers with a zod payload schema (`defineJobHandler`, `failJob`, `retryJobLater`);
  `runJobWorker` and `runJobWorkerProcess` (`@softure-ai/jobs/worker`): claim with `FOR UPDATE SKIP LOCKED` under a
  lease, a heartbeat for long jobs, fenced completion, retry with exponential backoff and jitter, a terminal `failed`
  state, pruning, and release of unfinished jobs on SIGTERM; `runDueJobs` (`@softure-ai/jobs/testing`) runs due jobs
  in-process for tests and cron-driven apps.

