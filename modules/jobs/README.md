# @softure-ai/jobs

Background jobs in Postgres: an app enqueues work in the same transaction as its own write, and a worker process
runs it with leases, retries and a terminal failure state. Built for the case an adopting app solved by hand (a job
table of its own and a `scripts/worker.ts` loop): a slow or unreliable call after a request, such as an AI call per
received message.

## 1. What it provides

A job queue in one table (`jobs.jobs`) with enqueue inside the caller's transaction and dedup keys, claims with
`FOR UPDATE SKIP LOCKED` under a lease, fenced completion, retry with exponential backoff, a worker process with
graceful shutdown, and an in-process runner for tests and cron-driven apps.

## 2. Installation

```bash
npm install @softure-ai/jobs @softure-ai/core @softure-ai/db drizzle-orm zod
```

The worker runs as its own process. With `@softure-ai/deploy`, `softure-deploy init` sees `@softure-ai/jobs` in
`package.json` and adds `scripts/worker.ts`, its bundle in the image and a `worker` service next to the app (deploy
README, "Job worker").

## 3. Configuration

```ts
import { defineSoftureConfig } from "@softure-ai/core";
import { jobs } from "@softure-ai/jobs";

export default defineSoftureConfig({
  // database, locale, timezone, appOrigin …
  modules: [
    jobs({
      queues: {
        "ai.reply": { maxAttempts: 5, backoff: { baseSeconds: 10, maxSeconds: 600 }, leaseSeconds: 120, concurrency: 4 },
        "mail.digest": {},
      },
    }),
  ],
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `queues.<name>.maxAttempts` | `5` | attempts before a job is `failed`; the first run counts |
| `queues.<name>.backoff` | `{ baseSeconds: 10, maxSeconds: 3600 }` | delay after attempt n is `min(max, base * 2^(n-1))`, shortened by up to 20 % at random |
| `queues.<name>.leaseSeconds` | `300` | how long a claimed job is reserved; the worker extends it while the handler runs, so it bounds how long a crashed worker's job waits, not how long a handler may take |
| `queues.<name>.concurrency` | `1` | jobs of the queue one worker process runs at once |
| `pollIntervalMs` | `1000` | how often an idle worker looks for due jobs |
| `shutdownGraceMs` | `20000` | how long a stopping worker waits for running handlers before releasing their jobs |
| `retention` | `{ succeededDays: 7, failedDays: 30, cancelledDays: 7 }` | how long finished jobs are kept; the worker prunes once an hour |

A queue name is lowercase letters, digits, `_`, `.` and `-`. A queue the config does not define is refused by
`enqueueJob` and by the worker: a typo is a bug, not a new queue.

### Handlers

One handler per queue, with the zod schema of its payload. The payload read back from the table is parsed with it
before the handler runs; a payload that does not match fails the job with `jobs.invalid_payload` and is not retried.

```ts
// src/jobs/handlers.ts
import { ok } from "@softure-ai/core";
import { defineJobHandler, failJob, retryJobLater, type JobHandlers } from "@softure-ai/jobs";
import { z } from "zod";

export const handlers: JobHandlers = {
  "ai.reply": defineJobHandler({
    payload: z.object({ messageId: z.string() }),
    run: async ({ messageId }, { db, signal, job }) => {
      const message = await findMessage(db, messageId);
      if (message === null) return failJob("app.message_gone"); // failed at once, no retry
      const reply = await callModel(message, { signal });
      if (reply.status === 429) return retryJobLater("app.rate_limited", reply.retryAfterSeconds);
      if (!reply.ok) return reply; // an Err: retried with the queue's backoff
      await saveReply(db, messageId, reply.value);
      return ok();
    },
  }),
};
```

- `ok()`: done, the job is `succeeded`.
- An `Err` (any `Result` failure): retried after the backoff delay, until `maxAttempts`; then `failed`.
- `failJob(code)`: `failed` at once.
- `retryJobLater(code, seconds)`: retried after `seconds` instead of the backoff (a provider's `Retry-After`); still
  counts as an attempt.
- A throw: retried like an `Err` with the code `jobs.handler_threw`, and logged with the error.

**Handlers run at least once.** A worker can die after the side effect and before recording it, a lease can end, a
stopping worker releases unfinished jobs: the job then runs again. Make handlers idempotent (check whether the reply
was already saved, pass an idempotency key to the provider).

`context.signal` aborts when the job is taken from the handler: the worker's grace period ended on shutdown, or its
lease could not be extended. Pass it to `fetch` and other cancellable calls; anything the handler returns afterwards
is not recorded. `context.db` is the worker's pool, not a transaction; `context.job.attempts` is this attempt's number.

### Enqueueing

```ts
import { enqueueJob } from "@softure-ai/jobs/server";

await db.transaction(async (tx) => {
  const [message] = await tx.insert(messages).values(input).returning();
  await enqueueJob({ db: tx, clock, config }, { queue: "ai.reply", payload: { messageId: message.id }, dedupKey: message.id });
});
```

| Field | Meaning |
| --- | --- |
| `queue` | a configured queue |
| `payload` | JSON for the handler, `{}` when there is none; stored as `jsonb`, so a `Date` comes back as a string. Ids, not personal data |
| `runAt` / `delaySeconds` | when the job is due; default now; one or the other |
| `dedupKey` | while a pending or running job of the queue has this key, the call returns that job (`isDuplicate: true`) instead of writing a second one; a finished job frees the key |
| `maxAttempts` | this job's own limit instead of the queue's |

Inside the caller's transaction the job exists exactly when the caller's change commits; a rolled-back transaction
leaves no job behind.

### Running the worker

```ts
// scripts/worker.ts
import { runJobWorkerProcess } from "@softure-ai/jobs/worker";
import config from "../softure.config";
import { handlers } from "../src/jobs/handlers";

await runJobWorkerProcess({ config, handlers });
```

`runJobWorkerProcess` opens its own pool (`database.url`, or the app's `database.handle`) with one connection per job
that can run at once plus one, runs the worker until SIGTERM or SIGINT, closes the pool and sets `process.exitCode`
(0 after a clean stop, 1 when it could not start). Pass `logger: createLogger("jobs")` from
`@softure-ai/observability` to send its lines to OpenTelemetry; by default they go to the console. `queues: [...]`
runs only some queues (one worker per queue group).

The worker claims due jobs of every queue it has a handler for, up to each queue's `concurrency`, oldest due first.
A claim counts as an attempt and takes a lease, which a heartbeat extends while the handler runs. A worker that dies
leaves its jobs `running` until their lease ends; the next claim then takes them over (or fails them with
`jobs.lease_expired` when no attempt is left). Every write after a claim is fenced by a claim token, so the worker
whose lease was taken over cannot record an outcome over the newer attempt. Several workers can run side by side:
`SKIP LOCKED` hands each job to one of them.

On SIGTERM the worker stops claiming, waits up to `shutdownGraceMs` for running handlers, then aborts the rest and
releases their jobs (pending again, due now, the attempt given back). Database errors while claiming or recording are
logged and retried on the next round; a database restart does not end the worker.

`runJobWorker({ db, config, handlers, signal })` is the loop without the process part, for an app that runs it inside
a process of its own.

### Without a worker

`runDueJobs(ctx, { handlers })` (from `@softure-ai/jobs/server` or `/testing`) runs every due job once, in this process,
one after another, and returns `{ succeeded, retried, failed, stale }`. A cron can drain a queue with it; call
`pruneJobs(ctx)` from the same cron.

### Steering and overview

From `@softure-ai/jobs/server`, each on `ctx = { db, clock, config }`:

| Function | Result |
| --- | --- |
| `getJob(ctx, id)` | the `Job` or `null` |
| `cancelJob(ctx, id)` | a pending job becomes `cancelled`; `jobs.not_cancellable` for a running or finished one, `jobs.not_found` |
| `retryJob(ctx, id)` | a failed or cancelled job runs again from scratch (attempts 0, due now); `jobs.not_retryable`, `jobs.dedup_key_taken` while a live job has its key, `jobs.not_found` |
| `getQueueStats(ctx)` | per queue: counts per status, the due backlog and the `run_at` of its oldest due job |
| `pruneJobs(ctx)` | deletes finished jobs past their retention; returns the count |

`getQueueStats` suits an app health check of its own, `ops({ checks: { "app.jobs": … } })`, e.g. unavailable when the
oldest due job of a queue waited more than ten minutes (no worker is running). An ops script (`@softure-ai/ops/scripts`)
can wrap `retryJob` and `cancelJob` for the operator.

## 4. Mounting

Nothing to mount: the module has no routes or pages. The worker is a process (§3, "Running the worker").

## 5. Migrations and tables

Schema `jobs`, one table, `migrations/0001_create_jobs.sql`:

`jobs.jobs`: `id` (bigint identity; a string in the API), `queue`, `payload` (jsonb), `status` (`pending`, `running`,
`succeeded`, `failed`, `cancelled`), `attempts`, `max_attempts`, `run_at`, `locked_until`, `locked_by` (the worker,
`<hostname>:<pid>`), `claim_token`, `dedup_key`, `last_error` (an error code, never a message), `created_at`,
`updated_at`, `finished_at`. Checks keep the lease columns set exactly while `running` and `finished_at` set exactly
for finished jobs; a partial unique index allows one live job per queue and dedup key.

The app role needs `SELECT, INSERT, UPDATE, DELETE` on the table, which the `@softure-ai/ops` roles recipe grants on
every schema the migrator creates.

## 6. Environment variables

None of its own. The worker reads the app's config, so it gets the app's `DATABASE_URL` and whatever its handlers need.

## 7. Switches

None.

## 8. Appearance

No UI.

## 9. Copy

`errors.*` in `src/messages/en.ts`, one key per error code (`invalid_payload`, `handler_threw`, `lease_expired`,
`not_found`, `not_cancellable`, `not_retryable`, `dedup_key_taken`), for an admin screen that shows a job's state.

## 10. Hooks

The handlers (§3) are the app's code. `logger` (`info`, `warn`, `error`; `@softure-ai/observability`'s `Logger` fits)
receives the worker's lines: started, stopped, a thrown handler with its error, a lost lease, a release, pruning.

## 11. GDPR

No export or deletion contributor: jobs are transient and pruned (§3, `retention`). Keep personal data out of
payloads (ids only); then a deleted account leaves nothing personal in `jobs.jobs`. `last_error` holds codes, and the
logger gets payload paths, never values, for a payload that does not match its schema.

## 12. Limitations

- Polling, no `LISTEN/NOTIFY`: a job waits up to `pollIntervalMs` when the worker is idle.
- No cron schedules or recurring jobs: a cron (or a handler that enqueues its next run) does that.
- No priorities within a queue and no rate limits per queue beyond `concurrency`; split work into queues instead.
- At-least-once delivery (§3, "Handlers run at least once").
- PGlite has one connection, so tests run claims one after another; concurrent claiming is Postgres behaviour
  (`SKIP LOCKED`) and is not exercised in unit tests.
