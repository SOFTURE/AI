# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/jobs`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## 0.1.0

- First version (#471): background jobs in Postgres (`jobs.jobs`). `jobs({ queues })` in `softure.config.ts`;
  `enqueueJob` inside the caller's transaction with an optional `dedupKey`; `cancelJob`, `retryJob`, `getJob`,
  `getQueueStats`, `pruneJobs`; handlers with a zod payload schema (`defineJobHandler`, `failJob`, `retryJobLater`);
  `runJobWorker` and `runJobWorkerProcess` (`@softure-ai/jobs/worker`): claim with `FOR UPDATE SKIP LOCKED` under a
  lease, a heartbeat for long jobs, fenced completion, retry with exponential backoff and jitter, a terminal `failed`
  state, pruning, and release of unfinished jobs on SIGTERM; `runDueJobs` (`@softure-ai/jobs/testing`) runs due jobs
  in-process for tests and cron-driven apps.
