# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/jobs`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

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

