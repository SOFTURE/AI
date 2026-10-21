# @softure-ai/jobs

Background jobs in Postgres: an app enqueues work in the same transaction as its own write, and a worker process
runs it with leases, retries and a terminal failure state. Built for the case an adopting app solved by hand (a job
table of its own and a `scripts/worker.ts` loop): a slow or unreliable call after a request, such as an AI call per
received message.

## 1. What it provides

A job queue in one table (`jobs.jobs`) with enqueue inside the caller's transaction and dedup keys, claims with
`FOR UPDATE SKIP LOCKED` under a lease, fenced completion, retry with exponential backoff, a worker process with
graceful shutdown, recurring schedules that run once per period however many workers run, and an in-process runner
for tests and cron-driven apps. For jobs that poll a third-party source: a cursor per source and a processed-item
ledger, so a second run never acts twice on the same item (§3, "Sync state for polling").

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
| `schedules.<queue>.every` | (one of `every`, `at`) | how often the schedule runs: `<n>m`, `<n>h` or `<n>d`, from `1m` to `7d`, aligned to UTC (§3, "Schedules") |
| `schedules.<queue>.at` | (one of `every`, `at`) | local times of day the schedule runs at, `HH:MM` (`00:00` to `23:59`), each once, up to 48 |
| `schedules.<queue>.timeZone` | (required with `at`) | the IANA time zone of `at`, such as `Europe/Warsaw` or `UTC` |
| `schedules.<queue>.payload` | `{}` | the payload of every scheduled run |
| `pollIntervalMs` | `1000` | how often an idle worker looks for due jobs |
| `shutdownGraceMs` | `20000` | how long a stopping worker waits for running handlers before releasing their jobs |
| `retention` | `{ succeededDays: 7, failedDays: 30, cancelledDays: 7, syncItemsDays: 90 }` | how long finished jobs, and sync ledger items no run met, are kept; the worker prunes once an hour |

A queue name is lowercase letters, digits, `_`, `.` and `-`. A queue the config does not define is refused by
`enqueueJob` and by the worker: a typo is a bug, not a new queue. A schedule defines its queue too, with the default
settings unless `queues` names it; the config needs at least one queue or schedule.

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

**Health check of the loop.** A process that is alive is not a loop that runs: a hung claim query or a database
connection the worker never gets back leaves the process up and the jobs untouched. With `healthFile`, the loop
touches that file after each round in which every claim reached the database (it removes a file left by an earlier
run at start, and removes its own after a clean stop), and the same entry answers `--health` instead of running:

```ts
// scripts/worker.ts
await runJobWorkerProcess({ config, handlers, healthFile: "/tmp/softure-jobs-worker.alive" });
```

```yaml
# docker compose: the worker service
healthcheck:
  test: ["CMD", "node", "worker.mjs", "--health"]
```

`node worker.mjs --health` opens no database and starts no loop: it exits 0 when the file is no older than
`healthMaxAgeMs` (default five poll intervals, at least 30 s: `getJobWorkerHealthMaxAgeMs(config)`) and 1 when it is
missing or older, with one line saying which. `--health` without `healthFile` exits 1 rather than start a second
worker; an older jobs version has no `--health` and would start one, so switch the check only after upgrading. An app
that runs the loop itself passes `healthFile` to `runJobWorker` and checks with
`checkJobWorkerHealth({ healthFile, maxAgeMs })`. `docker compose up --wait` then waits for a loop that reached the
database, and the container reads `unhealthy` while it is stuck; Docker's `restart:` policy does not act on that
status (a monitor or an orchestrator does). `@softure-ai/deploy` writes both lines from `init`.

`runJobWorker({ db, config, handlers, signal })` is the loop without the process part, for an app that runs it inside
a process of its own.

### Schedules

A schedule runs its queue's handler once per period (`every`) or at local times of day (`at` in `timeZone`), instead
of an app cron:

```ts
import { authJobSchedules } from "@softure-ai/auth/jobs";
import { securityJobSchedules } from "@softure-ai/security/jobs";

jobs({
  schedules: {
    ...authJobSchedules, // auth.prune-sessions hourly, auth.prune-password-resets daily
    ...securityJobSchedules, // security.prune-rate-limits hourly
    "app.digest": { every: "1d", payload: { kind: "weekly" } },
    // The trial-ending reminder at 09:00 and 21:00 in the users' time zone, in place of billing's daily UTC period.
    "billing.access-reminders": { at: ["09:00", "21:00"], timeZone: "Europe/Warsaw" },
  },
});
```

```ts
// src/jobs/handlers.ts: the packages' handlers next to the app's own
import { authJobHandlers } from "@softure-ai/auth/jobs";
import { securityJobHandlers } from "@softure-ai/security/jobs";

export const handlers: JobHandlers = { ...authJobHandlers, ...securityJobHandlers, "app.digest": digestHandler };
```

- Periods start on whole multiples of `every` counted from 1970-01-01 00:00 UTC: `1h` on the full hour, `1d` at
  midnight UTC, `15m` at :00, :15, :30, :45. A run is due at the start of its period.
- An `at` schedule's slots are its listed times on each local date in `timeZone`, with the zone's offset on that date:
  `09:00` in `Europe/Warsaw` is 07:00 UTC in summer and 08:00 UTC in winter. A time a DST change skips runs as far
  after the change as it would have been (`02:30` on the spring-forward day runs at 03:30); a time a DST change
  repeats runs once, at its first occurrence. A worker that starts after a listed time enqueues that slot's run at
  once, the same way a period schedule enqueues the period it starts in.
- Once per period, however many workers run: a worker takes a period with a conditional upsert of
  `jobs.schedules` (the period must be later than the stored one) and enqueues the run in the same transaction, so a
  missed or doubled tick cannot happen. A worker enqueues only the schedules of the queues it runs.
- Missed periods or times (no worker ran) collapse into one run for the current slot.
- Every scheduled run has the dedup key `schedule`: while a run is still pending or running (retrying a failure), the
  next period joins it instead of queueing a second run behind it.
- Scheduled runs are ordinary jobs: retries, `maxAttempts`, `getJob`, `retryJob` and pruning apply.
- A package's prune handlers live in its `./jobs` entry (`@softure-ai/auth/jobs`, `@softure-ai/mcp-access/jobs`,
  `@softure-ai/waitlist/jobs`, `@softure-ai/security/jobs`, `@softure-ai/analytics/jobs`), with `@softure-ai/jobs` as an
  optional peer.

`getQueueStats` reports each scheduled queue's `schedule`: `everySeconds` (for an `at` schedule the longest gap
between two of its times, 24h for one time), `lastEnqueuedAt` (the start of the latest slot a run was enqueued for), `lastSucceededAt` (any succeeded job of the queue, a run enqueued by hand too),
`lastFailedAt` and `lastFailureCode` (the latest job of the queue that ended `failed`, with its error code: the
handler's code, `jobs.handler_threw`, `jobs.invalid_payload` or `jobs.lease_expired`, never an error's text; a retried
attempt is not a failure until the attempts are used up), `isFailing` and `isLate`. A queue is failing when its latest
outcome is a failure: `isFailing` is `lastFailedAt !== null && (lastSucceededAt === null || lastFailedAt >
lastSucceededAt)`. It is late when no run succeeded within two periods, counted from when a worker first saw the
schedule, or no worker has seen it at all. Successes and failures are recorded once a worker has taken the schedule's
first slot (its row in `jobs.schedules` exists), and they outlive the pruned jobs.

An app that shows how fresh a synced source is needs nothing else:

```ts
const sync = (await getQueueStats(ctx)).find((stats) => stats.queue === "app.sync")?.schedule;
// "Updated at {lastSucceededAt}", plus "the last update failed ({lastFailureCode})" while isFailing.
const freshness = { updatedAt: sync?.lastSucceededAt ?? null, isFailing: sync?.isFailing ?? false };
```

The module's health check does not fail on a late schedule (a late cleanup must not take the app out of
rotation); an app that wants an alarm adds a check of its own:

```ts
ops({
  checks: {
    "app.schedules": async (context) => {
      const late = (await getQueueStats(context as JobsContext)).filter((stats) => stats.schedule?.isLate === true);
      return late.length === 0 ? ok() : err("app.schedules_late");
    },
  },
});
```

### Without a worker

`runDueJobs(ctx, { handlers })` (from `@softure-ai/jobs/server` or `/testing`) enqueues the due runs of the schedules
among its queues, then runs every due job once, in this process, one after another, and returns
`{ succeeded, retried, failed, stale }`. A cron can drain a queue with it; call `pruneJobs(ctx)` from the same cron.
`enqueueDueSchedules(ctx, { queues? })` only enqueues the due scheduled runs.

### Sync state for polling

A job that polls a source (new mails under a label, changed tasks in a list, rows flagged for export) needs a cursor
that moves only after its batch was handled, and a ledger that remembers which items were handled. From
`@softure-ai/jobs/server`:

```ts
import { err, ok } from "@softure-ai/core";
import { skipSyncItem } from "@softure-ai/jobs";
import { advanceSyncCursor, getSyncCursor, processSyncItem } from "@softure-ai/jobs/server";

const from = await getSyncCursor(ctx, "gmail.inbox");
const batch = await gmail.listSince(from); // the app's own client
for (const message of batch.messages) {
  await processSyncItem(ctx, { source: "gmail.inbox", itemId: message.id, maxAttempts: 3 }, async ({ db }) => {
    if (!isTask(message)) return skipSyncItem("app.not_a_task");
    const created = await createTask(db, message); // written through the item's transaction
    return created.ok ? ok({ status: "done", resultRef: created.value.id }) : err("app.task_failed");
  });
}
await advanceSyncCursor(ctx, { source: "gmail.inbox", from, to: batch.nextCursor });
```

- `processSyncItem(ctx, { source, itemId, maxAttempts? }, run)` takes the item's ledger row (inserting it on first
  sight, locking it so two workers on one item take turns) and runs `run` unless the item is already `done`,
  `skipped` or `failed`, which returns `{ kind: "skipped", item }`. `run` gets `{ ...ctx, db, attempt }` where `db` is
  the item's transaction: writes through it commit together with the ledger's `done`, so "effect first, then
  acknowledge" needs no code of the app's. `ok()` or `ok({ status: "done", resultRef })` → `handled`, item `done`;
  `skipSyncItem(reason?)` → `handled`, item `skipped`; an `Err` → the writes roll back, the attempt counts, the item
  stays `pending` (`retrying`) until `maxAttempts` (default 5) runs failed, then `failed`; `failSyncItem(code)` fails
  it at once. A throw is recorded as a failed attempt with `jobs.sync_item_threw` and rethrown, so a poison item still
  ends `failed`.
- A call outside the database (an API) is not rolled back: a crash after it and before the commit repeats it on the
  next run. Keep it idempotent where the source allows, and keep each item short: its transaction stays open while
  `run` runs.
- `getSyncCursor(ctx, source)` returns the cursor or `null`. `advanceSyncCursor(ctx, { source, from, to })` is a
  compare-and-set: refused with `jobs.sync_cursor_moved` when the stored cursor is no longer `from`, so a slower
  worker cannot move it back; re-read and go on. Pass a transaction as `ctx.db` to move it with the batch's last write.
- `listSyncItems(ctx, { source?, status?, since?, limit? })` lists the ledger, most recently changed first (default
  100, at most 1000): what passed, what failed and with which code, for an overview page or an MCP tool.
- `pruneSyncItems(ctx)` deletes items no `processSyncItem` call met for `retention.syncItemsDays` (90), whatever
  their status; every call touches `last_seen_at`, so an item the source still returns is never forgotten (and never
  handled twice). The worker runs it with its hourly prune; an app without a worker calls it from its cron.
- A source name is lowercase letters, digits, `_ . : -`, starting with a letter, up to 127 characters (`gmail.inbox`,
  `todoist:project-42`); an item id up to 500 characters.
- In tests, `listSyncState(db)` from `@softure-ai/jobs/testing` returns `{ cursors, items }` for assertions after
  `runDueJobs` ran the polling job.

### Steering and overview

From `@softure-ai/jobs/server`, each on `ctx = { db, clock, config }`:

| Function | Result |
| --- | --- |
| `getJob(ctx, id)` | the `Job` or `null` |
| `cancelJob(ctx, id)` | a pending job becomes `cancelled`; `jobs.not_cancellable` for a running or finished one, `jobs.not_found` |
| `retryJob(ctx, id)` | a failed or cancelled job runs again from scratch (attempts 0, due now); `jobs.not_retryable`, `jobs.dedup_key_taken` while a live job has its key, `jobs.not_found` |
| `getQueueStats(ctx)` | per queue: counts per status, the due backlog, the `run_at` of its oldest due job and its `schedule` (or `null`) |
| `pruneJobs(ctx)` | deletes finished jobs past their retention; returns the count |

`getQueueStats` suits an app health check of its own, `ops({ checks: { "app.jobs": … } })`, e.g. unavailable when the
oldest due job of a queue waited more than ten minutes (no worker is running). An ops script (`@softure-ai/ops/scripts`)
can wrap `retryJob` and `cancelJob` for the operator.

## 4. Mounting

Nothing to mount: the module has no routes or pages. The worker is a process (§3, "Running the worker").

## 5. Migrations and tables

Schema `jobs`, four tables, `migrations/0001_create_jobs.sql`, `migrations/0002_create_schedules.sql`,
`migrations/0003_add_schedule_failures.sql` and `migrations/0004_create_sync_state.sql`:

`jobs.jobs`: `id` (bigint identity; a string in the API), `queue`, `payload` (jsonb), `status` (`pending`, `running`,
`succeeded`, `failed`, `cancelled`), `attempts`, `max_attempts`, `run_at`, `locked_until`, `locked_by` (the worker,
`<hostname>:<pid>`), `claim_token`, `dedup_key`, `last_error` (an error code, never a message), `created_at`,
`updated_at`, `finished_at`. Checks keep the lease columns set exactly while `running` and `finished_at` set exactly
for finished jobs; a partial unique index allows one live job per queue and dedup key.

`jobs.schedules`: `name` (the schedule's queue, primary key), `last_slot_at` (the start of the latest period a run
was enqueued for), `last_succeeded_at`, `last_failed_at`, `last_failure_code` (an error code, never a message),
`created_at`, `updated_at`. One row per schedule a worker has seen; a row of
a schedule removed from the config stays and is ignored.

`jobs.sync_cursors`: `source` (primary key), `cursor` (1 to 2000 characters), `created_at`, `updated_at`.

`jobs.sync_items`: `source` and `item_id` (primary key), `status` (`pending`, `done`, `skipped`, `failed`),
`error_code` (the last failure's code or the skip reason, never a message), `attempts`, `result_ref` (done items only),
`first_seen_at`, `last_seen_at`, `updated_at`, `finished_at`. Checks keep `finished_at` set exactly for final items and
an error code on failed ones.

The app role needs `SELECT, INSERT, UPDATE, DELETE` on the tables, which the `@softure-ai/ops` roles recipe grants on
every schema the migrator creates.

## 6. Environment variables

None of its own. The worker reads the app's config, so it gets the app's `DATABASE_URL` and whatever its handlers need.

## 7. Switches

None.

## 8. Appearance

No UI.

## 9. Copy

`errors.*` in `src/messages/en.ts`, one key per error code (`invalid_payload`, `handler_threw`, `lease_expired`,
`not_found`, `not_cancellable`, `not_retryable`, `dedup_key_taken`, `sync_cursor_moved`, `sync_item_threw`), for an
admin screen that shows a job's or a sync item's state.

## 10. Hooks

The handlers (§3) are the app's code. `logger` (`info`, `warn`, `error`; `@softure-ai/observability`'s `Logger` fits)
receives the worker's lines: started, stopped, a scheduled run enqueued, a thrown handler with its error, a lost lease,
a release, pruning.

## 11. GDPR

No export or deletion contributor: jobs are transient and pruned (§3, `retention`). Keep personal data out of
payloads (ids only); then a deleted account leaves nothing personal in `jobs.jobs`. `last_error` holds codes, and the
logger gets payload paths, never values, for a payload that does not match its schema. The sync ledger holds the
source's item ids, not their content; if an id is personal (an e-mail address), the app hashes it before passing it.

## 12. Limitations

- Polling, no `LISTEN/NOTIFY`: a job waits up to `pollIntervalMs` when the worker is idle.
- Schedules take a fixed period aligned to UTC (`every`) or times of day in a time zone (`at`); no cron expressions,
  no days of the week.
- No priorities within a queue and no rate limits per queue beyond `concurrency`; split work into queues instead.
- At-least-once delivery (§3, "Handlers run at least once").
- PGlite has one connection, so tests run claims one after another; concurrent claiming is Postgres behaviour
  (`SKIP LOCKED`) and is not exercised in unit tests.
