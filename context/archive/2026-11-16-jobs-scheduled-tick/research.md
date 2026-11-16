# Research: jobs-scheduled-tick

## How it works today

- `runJobWorker` (`modules/jobs/src/worker/run-job-worker.ts`) is a long-running loop. Each round it enqueues the due
  runs of the schedules (`enqueueScheduledRun`, a conditional upsert of `jobs.schedules` in one transaction with the
  enqueue), checks schedule health once a minute (`checkScheduleStates`), claims up to each queue's free concurrency
  (`claimJobs`, `FOR UPDATE SKIP LOCKED` under a lease), runs each claimed job with a lease heartbeat
  (`heartbeatJob` every third of the lease), prunes jobs, runs and sync items once an hour, touches the health file and
  sleeps `pollIntervalMs` or until a job ends.
- Node-only parts: `node:os` `hostname` for the default worker id, `node:fs` for the health file
  (`worker/health.ts`), `process` signals and `openCommandDatabase` in `worker/process.ts`.
- `runDueJobs` (`server/run-due.ts`) drains due jobs one by one with no lease heartbeat and no time limit: written for
  tests and cron-driven apps; it would run a whole backlog in one Workers invocation.
- `worker/database-outage.ts` logs database failures; it imports nothing Node-only.
- Value imports of `@softure-ai/db` (Node root entry) on the request path: `server/admin.ts`
  (`isConstraintViolation`) and `next/context.ts` (`getConfiguredDatabase`). Both are in `@softure-ai/db/request`.

## Workers facts (measured in RP-2, RP-5, RP-7)

- `@softure-ai/db/request` opens a request-scoped handle inside `withRequestDatabase({ url, waitUntil })`;
  `getConfiguredDatabase` returns it inside the scope. A Cron Trigger's `scheduled(controller, env, ctx)` is an
  invocation like a request: the same scope works, with the Hyperdrive connection string from `env`.
- A Cron Trigger runs at most every minute; its wall time can reach 15 minutes, CPU time is limited separately.
  Several invocations may overlap when one runs past a minute.
- `setInterval`/`setTimeout` work during `waitUntil`, so the lease heartbeat can run unchanged.

## What depends on it

- Every module's `./jobs` entry (alerts, analytics, auth, billing, blog, files, mailing, mcp-access, metering, security,
  waitlist) imports `@softure-ai/jobs` and was left undeclared by RP-7; so were alerts `./server`/`./next` and blog
  `./server`, which reach `./jobs`.

## Risks

- Overlapping ticks: claims, schedule slots and completions are already transactional and fenced by the claim token,
  so two ticks never run one job twice (existing tests in `schedules.test.ts`, `process.test.ts`).
- A job longer than the platform's limit is stopped by the platform: its lease runs out and the next claim records
  `jobs.lease_expired` (counted as an attempt), so it cannot loop silently.
- Hourly pruning needs state across ticks: a row in a new heartbeat table carries it.
