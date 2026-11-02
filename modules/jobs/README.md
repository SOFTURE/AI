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
ledger, so a second run never acts twice on the same item (§3, "Sync state for polling"). For the operator: an admin
page with the queues, schedule health, running jobs with their progress, recent failures and the sync ledger, with Run
now, Retry and Cancel (§4). A running handler reports its progress, and an operator can stop a running job (§3,
"Progress and cancelling"). For the user who started a job: an owner on the job, a status route and a polling hook for
the waiting screen (§3, "A user follows their own job").

## 2. Installation

```bash
npm install @softure-ai/jobs @softure-ai/core @softure-ai/db drizzle-orm zod
```

The admin page (§4) also needs `@softure-ai/ui`, `next` and `react`, and `@softure-ai/auth` for its role check; a
worker-only app needs none of them.

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
| `schedules.<queue>.daysOfWeek` | every day | with `at`: the local days of the week it runs on, ISO `1` (Monday) to `7` (Sunday), each once |
| `schedules.<queue>.daysOfMonth` | every day | with `at`: the local days of the month it runs on, `1` to `31` or `"last"`, each once |
| `schedules.<queue>.payload` | `{}` | the payload of every scheduled run |
| `pollIntervalMs` | `1000` | how often an idle worker looks for due jobs |
| `shutdownGraceMs` | `20000` | how long a stopping worker waits for running handlers before releasing their jobs |
| `retention` | `{ succeededDays: 7, failedDays: 30, cancelledDays: 7, syncItemsDays: 90, runsDays: 30, ownedDays: 1 }` | how long finished jobs, sync ledger items no run met, and the run history (§3, "Run history") are kept, and the floor for a job a user follows (§3, "A user follows their own job"); the worker prunes once an hour |
| `logRuns` | `"all"` | which ends of a run the worker logs, one line each (§10): `"all"` (succeeded, retried, failed), `"failures"` (retried and failed) or `"none"` |
| `onJobFailed` | none | `(event, ctx)`, run once when a job ends `failed` (§3, "Alert hooks") |
| `onScheduleStateChanged` | none | `(event, ctx)`, run once per transition of a schedule between `healthy`, `failing` and `late` (§3, "Alert hooks") |
| `panelRole` | `"admin"` | the auth role that may open the admin page and use its actions (§4) |
| `panelGuard` | none | the page's role check, `{ requireRole, authorizeRole }` from `@softure-ai/auth/next`; without it the page is "not found" for everyone (§4) |
| `routes.panel` | `/admin/jobs` | the page's path, for revalidation after an action (§4) |

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
      // requestJson (`@softure-ai/core`) parses Retry-After into retryAfterSeconds on a 429 or 5xx
      if (!reply.ok && reply.error === "core.http_rate_limited") {
        return retryJobLater("app.rate_limited", reply.retryAfterSeconds ?? 60);
      }
      if (!reply.ok) return reply; // an Err: retried with the queue's backoff
      await saveReply(db, messageId, reply.value);
      return ok();
    },
  }),
};
```

- `ok()`: done, the job is `succeeded`. `ok({ summary })` also leaves a code-only summary in the run history (§3,
  "Run history").
- An `Err` (any `Result` failure): retried after the backoff delay, until `maxAttempts`; then `failed`.
- `failJob(code)`: `failed` at once.
- `retryJobLater(code, seconds)`: retried after `seconds` instead of the backoff (a provider's `Retry-After`); still
  counts as an attempt.
- A throw: retried like an `Err` with the code `jobs.handler_threw`, and logged with the error.

**Handlers run at least once.** A worker can die after the side effect and before recording it, a lease can end, a
stopping worker releases unfinished jobs: the job then runs again. Make handlers idempotent (check whether the reply
was already saved, pass an idempotency key to the provider).

`context.signal` aborts when the job is taken from the handler: the worker's grace period ended on shutdown, its lease
could not be extended, or an operator cancelled the job (§3, "Progress and cancelling"). Pass it to `fetch` and other
cancellable calls. After a shutdown or a lost lease anything the handler returns afterwards is not recorded; after a
cancel the job ends `cancelled`. `context.db` is the worker's pool, not a transaction; `context.job.attempts` is this attempt's number.

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
| `origin` | what started the job, kept with it and its runs: default `app`; the schedule's runs are `schedule`, `runScheduleNow`'s `manual`; an app names its own (`webhook.stripe`), lowercase like a queue name |

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

**A short database outage is not an error.** When the database is unavailable (SQLSTATE 57P01 to 57P03 or class 08, a
refused, reset or closed connection: `isDatabaseUnavailableError(error)` from `/server`), the worker logs each failed
call as `info` with `outageMs` (time since the outage's first failure) for the first `databaseOutageToleranceMs`
(default 60 000), and as `error` after that; the first call that succeeds again logs `info: database reachable again`
with `outageMs`. A round stops claiming at the first such failure, so a database that went away a moment before
SIGTERM (a host restart) writes one line per round instead of one per queue. Any other failure stays `error`.
`databaseOutageToleranceMs: 0` logs every one as `error`. The health file below still turns a worker that stays cut
off from the database `unhealthy`.

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
    ...securityJobSchedules, // security.prune-rate-limits hourly, security.prune-webhook-deliveries daily
    "app.digest": { every: "1d", payload: { kind: "weekly" } },
    // The trial-ending reminder at 09:00 and 21:00 in the users' time zone, in place of billing's daily UTC period.
    "billing.access-reminders": { at: ["09:00", "21:00"], timeZone: "Europe/Warsaw" },
    // Hourly from 08:00 to 20:00, Monday to Friday; on the 10th of each month; on the month's last day.
    "app.inbox-poll": {
      at: ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"],
      timeZone: "Europe/Warsaw",
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    "app.monthly-nudge": { at: ["08:00"], timeZone: "Europe/Warsaw", daysOfMonth: [10] },
    "app.close-period": { at: ["23:00"], timeZone: "Europe/Warsaw", daysOfMonth: ["last"] },
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
- `daysOfWeek` and `daysOfMonth` keep an `at` schedule's slots to the local dates in `timeZone` that match (both,
  when both are given). A day a month lacks never matches (`31` skips April); `"last"` is the month's last day,
  the 28th or 29th in February. Filters apply to `at` only; on `every` they are refused at startup.
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

`getQueueStats` reports each scheduled queue's `schedule`: `everySeconds` (for an `at` schedule the gap from its
current slot to the next: 60h on a Saturday for a weekday schedule whose last time is Friday 20:00 and first Monday
08:00), `lastEnqueuedAt` (the start of the latest slot a run was enqueued for), `lastSucceededAt` (any succeeded job of the queue, a run enqueued by hand too),
`lastFailedAt` and `lastFailureCode` (the latest job of the queue that ended `failed`, with its error code: the
handler's code, `jobs.handler_threw`, `jobs.invalid_payload` or `jobs.lease_expired`, never an error's text; a retried
attempt is not a failure until the attempts are used up), `isFailing` and `isLate`. A queue is failing when its latest
outcome is a failure: `isFailing` is `lastFailedAt !== null && (lastSucceededAt === null || lastFailedAt >
lastSucceededAt)`. It is late when no run succeeded within two periods, counted from when a worker first saw the
schedule, or no worker has seen it at all; for an `at` schedule two periods are its next two slots after that
success, so the weekday schedule is not late over the weekend and is late after Monday 09:00 when the 08:00 run has
not succeeded. Successes and failures are recorded once a worker has taken the schedule's
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

### Alert hooks

An app that must tell its operator when unattended work breaks sets two optional hooks instead of polling
`getQueueStats` and keeping its own "already alerted" state:

```ts
jobs({
  schedules: { "app.sync": { every: "1h" } },
  onJobFailed: async ({ queue, jobId, code, attempts, at }, ctx) => {
    if (queue === "ops.alert") return; // an alert that failed must not enqueue another alert
    await enqueueJob(ctx, { queue: "ops.alert", payload: { kind: "job_failed", queue, jobId, code, attempts, at: at.toISOString() } });
  },
  onScheduleStateChanged: async ({ queue, state, lastFailureCode, at }, ctx) => {
    // state: "failing", "late", or "healthy" again after a recovery.
    await enqueueJob(ctx, { queue: "ops.alert", payload: { kind: "schedule", queue, state, lastFailureCode, at: at.toISOString() } });
  },
});
```

- `onJobFailed({ queue, jobId, code, attempts, at }, ctx)` runs once when a job ends `failed`: attempts used up,
  `failJob`, a payload that does not match its schema (`jobs.invalid_payload`), or a lease that ended with no attempts
  left (`jobs.lease_expired`). Not for a retried attempt and not for an outcome the claim fence refused. It runs after
  the write commits, in the process that recorded it (the worker, `runDueJobs`, or an app calling `completeJob` or
  `claimJobs`).
- `onScheduleStateChanged({ queue, state, lastFailureCode, at }, ctx)` runs once per transition of a scheduled queue
  into or out of trouble. `state` is `failing` when `isFailing`, else `late` when `isLate`, else `healthy` (§3,
  "Schedules"): one state at a time, so a failing hourly job that also turns late alerts once, and the next success
  reports `healthy`. The last reported state is kept in `jobs.schedules.reported_state` and moved with a conditional
  update, so one worker reports each transition however many run. The worker checks at most once a minute (lateness
  moves with the clock alone); `runDueJobs` checks once at its end; `checkScheduleStates(ctx, { logger? })` from
  `@softure-ai/jobs/server` checks on demand. A schedule no worker has enqueued yet is skipped. Without the hook,
  nothing is checked or written.
- Events carry codes and ids only, never a payload or an error's text. A hook that throws is logged through `logger`
  (`the onJobFailed hook failed`, with the error's kind) and never fails the job, the claim or the worker; the
  transition stays reported. A hook is awaited: keep it short, or enqueue a job (as above) that sends the mail
  (`@softure-ai/mailing`) with its own retries.
- In tests, `recordJobHooks()` from `@softure-ai/jobs/testing` gives `{ options, failedJobs, scheduleStateChanges }`:
  pass `jobs({ queues, ...recorder.options })` and assert the arrays after `runDueJobs`.

### Run history

Every recorded attempt leaves one row in `jobs.runs`: the job id, queue, `origin`, attempt number, outcome
(`succeeded`, `retried`, `failed`, `cancelled`), the error code of a failure, the handler's summary, and when it started and
finished. Rows are written in the transaction that records the outcome, so an attempt another claim replaced leaves
none, and a lease that ended with no attempts left leaves a `failed` row with `jobs.lease_expired` and no start. They
are kept for `retention.runsDays` (30), whatever happens to the job: a succeeded job is still pruned after
`succeededDays`, its runs are not.

A handler adds a summary with `ok({ summary })`, codes and counts only:

```ts
return ok({
  summary: {
    code: "sync.imported", // what the run came to, a lowercase code
    items: { new: created, skipped, failed }, // non-negative integers, each optional
    steps: { fetch: "done", parse: "done", notify: "skipped" }, // step name → done | skipped | failed, at most 50
  },
});
```

The summary is checked with `jobRunSummarySchema` (exported with the `JobRunSummary` type). One that does not match is
dropped with a warning that names its paths, never its values, and the job stays succeeded: it did its work. `ok()`
and `ok(value)` without a `summary` key record no summary. A failure has no summary; its code is the run's.

- `listJobRuns(ctx, { queue?, origin?, outcomes?, limit? })` from `/server` lists runs newest first (default 50, at
  most 500): "what did each run do, what started it".
- `pruneJobRuns(ctx)` deletes runs past `runsDays`; the worker runs it with its hourly prune.
- In tests, `listRunHistory(db)` from `/testing` returns every run, oldest first.
- `runScheduleNow(ctx, queue, { origin })` names its origin (default `manual`); a call that joins a waiting run keeps
  that run's origin.

### Progress and cancelling

A long handler (a render, an import, a report) reports how far it got with `context.reportProgress`, codes and counts
only:

```ts
run: async ({ videoId }, { reportProgress, signal }) => {
  await reportProgress({ step: "render.fetch" });
  for (const [index, scene] of scenes.entries()) {
    await renderScene(scene, { signal });
    await reportProgress({ step: "render.encode", done: index + 1, total: scenes.length });
  }
  return ok();
},
```

- `step` and the optional `code` are lowercase codes (`^[a-z][a-z0-9_.-]{0,62}$`), `done` and `total` non-negative
  integers. The progress is checked with `jobProgressSchema` (exported with the `JobProgress` type); one that does
  not match is dropped with a warning naming its paths, never its values. A failed write is logged as a warning; the
  call never throws into the handler.
- At most one write per second per job: a report inside that second is held and written when the second ends or the
  handler returns, replaced by any newer report. Every write is fenced by the claim, like the outcome.
- `getJob` and `listRecentJobs` return it as `progress` with `progressAt`. A new attempt starts without one; a
  finished job keeps its last attempt's progress. The run summary (§3, "Run history") stays the record of what a run
  did.

`requestJobCancel(ctx, id)` from `/server` stops a job: a pending one is `cancelled` at once (as `cancelJob`), a
running one gets `cancelRequestedAt` and is returned still `running`. Its worker sees the request on its next
heartbeat (a third of the lease) or progress write, and aborts `context.signal` with a `JobCancelledError` (named
`AbortError`, `code: "jobs.cancelled"`; `isJobCancelled(signal)` tells it from a shutdown or a lost lease). Once the
handler returns, whatever it returns, the job is `cancelled`: not retried, no `onJobFailed`, the schedule's health
untouched, and a run with the outcome `cancelled` and the code `jobs.cancelled`. A requested job whose worker died is
`cancelled` when its lease ends instead of running again; one its stopping worker releases is `cancelled` too. A job
that finishes before its worker sees the request keeps its outcome, except a retry, which becomes `cancelled`. A
repeated request keeps the first time; a finished job answers `jobs.not_cancellable`. `cancelJob` keeps its meaning
(pending jobs only). `retryJob` on a cancelled job clears the request and the progress.

A worker of your own built on `claimJobs` uses `heartbeatJob(ctx, claimed)` (`held`, `cancel_requested` or `lost`)
in place of `extendJobLease` to see requests. `runDueJobs` has no heartbeat: it sees a request at the handler's next
progress write.

### A user follows their own job

A feature that runs in the background while its user waits (a link to summarize, a file to convert) stores the user
on the job and lets that user, and only that user, follow it:

```ts
// The request that starts the work.
const { id } = await enqueueJob(ctx, { queue: "ai.summarize", payload: { articleId }, ownerId: user.id });

// The handler names the row that holds the result: an id, never the result itself.
run: async ({ articleId }, { db }) => {
  const summary = await summarize(db, articleId);
  return ok({ resultRef: `summary:${summary.id}` });
},
```

- `ownerId` (1 to 200 characters) is stored on the job (`owner_id`, indexed). A `dedupKey` matches across owners: put
  the owner in the key when two owners must never share a job.
- `ok({ resultRef })` (with or without `summary`) keeps an identifier of the app's result on a succeeded job:
  letters, digits and `_ . : / -`, at most 200 characters. Anything else is dropped with a warning that does not
  repeat it; the job stays succeeded. `Job` gains `ownerId` and `resultRef`.
- `getOwnJob(ctx, { id, ownerId })` from `/server` answers `OwnJob`: `id`, `queue`, `status`, `progress`,
  `progressAt`, `resultRef`, `failureCode` (the failed job's error code, `jobs.cancelled` for a cancelled one,
  otherwise null), `cancelRequestedAt`, `createdAt`, `updatedAt`, `finishedAt`. Never the payload or an error's text.
  A job of someone else, one without an owner, a pruned one and an id that cannot be one all answer
  `jobs.not_found`, so a user cannot probe for jobs. `requestOwnJobCancel(ctx, { id, ownerId })` is
  `requestJobCancel` for the owner (the owner is in every statement). `toOwnJobStatus(job)` gives the JSON form
  (`OwnJobStatus`, times as ISO strings).
- `retention.ownedDays` (default 1) keeps an owned job readable after it ends, even when its status retention is
  shorter (`succeededDays: 0`), so a reload after the result still shows it. A longer status retention wins.

The route, one file; the session lookup is the app's (jobs does not depend on auth):

```ts
// app/api/jobs/[id]/route.ts
import { getCurrentUser } from "@softure-ai/auth/next";
import { createJobStatusRoute } from "@softure-ai/jobs/next";

export const { GET, DELETE } = createJobStatusRoute({
  getOwnerId: async () => (await getCurrentUser())?.id ?? null,
  allowCancel: true,
});
```

`GET` answers `200` with the `OwnJobStatus`, `401 { error: "auth.unauthorized" }` when `getOwnerId` gives null and
`404 { error: "jobs.not_found" }` otherwise. `DELETE` answers `405 { error: "jobs.cancel_not_allowed" }` unless
`allowCancel` is on; then `200` with the status (a pending job `cancelled`, a running one asked to stop), `404`, or
`409 { error: "jobs.not_cancellable" }` for a finished job. A database that cannot be opened is `503
jobs.unavailable`, any other failure `500 jobs.failed`, logged by kind only. Every answer is `Cache-Control:
no-store`. `getContext` replaces the registered config's database (a test database).

The waiting screen, in a client component, with `useJobStatus` from `@softure-ai/jobs/react` (React only, no
`@softure-ai/ui`):

```tsx
"use client";
import { useJobStatus } from "@softure-ai/jobs/react";

export function SummaryProgress({ jobId }: { jobId: string }) {
  const { job, error, cancel } = useJobStatus(jobId);
  if (error === "jobs.not_found") return <NotFound />;
  if (job?.status === "succeeded") return <SummaryLink resultRef={job.resultRef} />;
  if (job?.status === "failed" || job?.status === "cancelled") return <Failure code={job.failureCode} />;
  return <Progress step={job?.progress?.step} done={job?.progress?.done} total={job?.progress?.total} onCancel={cancel} />;
}
```

`useJobStatus(id, { url?, intervalMs?, maxIntervalMs?, stopOn? })` polls `url(id)` (default `/api/jobs/<id>`) every
`intervalMs` (1000); while nothing changes the interval grows by half up to `maxIntervalMs` (15 000), a change resets
it, a failed poll doubles it. It stops on `succeeded`, `failed` and `cancelled` (or `stopOn`) and on a 401 or 404,
pauses while the tab is hidden, and polls at once when the tab shows again or the browser comes back `online`. It
returns `{ job, error, isPolling, cancel }`: `error` is the route's code or `network`, and clears with the next good
answer; a body that is not a job status is `jobs.failed`. `cancel()` sends `DELETE` and returns `{ ok, value }` or
`{ ok: false, error }`. Pass `null` as the id while there is no job yet.

### Without a worker

`runDueJobs(ctx, { handlers })` (from `@softure-ai/jobs/server` or `/testing`) enqueues the due runs of the schedules
among its queues, then runs every due job once, in this process, one after another, checks schedule health for
`onScheduleStateChanged`, and returns `{ succeeded, retried, failed, stale }`. A cron can drain a queue with it; call `pruneJobs(ctx)` and `pruneJobRuns(ctx)` from the same cron.
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
  it at once; `waitSyncItem(code)` → the writes roll back but the attempt does not count: the item stays `pending`
  (`waiting`) with the code set, for a cause outside the item that only an operator clears (a connection that needs a
  reconnect, `connections.reconnect_required`). The next run that meets it tries again with the same attempt number,
  so the queue's backoff cannot use up its attempts. A throw is recorded as a failed attempt with `jobs.sync_item_threw` and rethrown, so a poison item still
  ends `failed`.
- A call outside the database (an API) is not rolled back: a crash after it and before the commit repeats it on the
  next run. Keep it idempotent where the source allows, and keep each item short: its transaction stays open while
  `run` runs.
- Every database access inside `run` goes through its `db`, never the outer `ctx.db`. On a real pool a read through
  `ctx.db` takes a second connection and sees nothing the item wrote; on the one-connection test database
  (`@softure-ai/db/testing`) it would wait for the item's transaction forever, so it rejects at once with
  `PoolInsideTransactionError` (recorded as a thrown attempt). A helper that takes a context gets the callback's,
  e.g. a delivery to a provider with its stored credential (`@softure-ai/connections`):

  ```ts
  import { requestWithConnection } from "@softure-ai/connections/server";

  await processSyncItem(ctx, { source: "crm.export", itemId: row.id }, async ({ db }) => {
    const sent = await requestWithConnection(
      { ...ctx, db }, // not ctx: the credential is read (and refreshed) in the item's transaction
      { provider: "crm" },
      { method: "POST", url: `${CRM_API}/contacts`, body: toContact(row), idempotencyKey: row.id },
    );
    return sent.ok ? ok() : err(sent.error);
  });
  ```

  A token refreshed during a delivery that then fails is rolled back with the item: the next attempt refreshes
  again (a provider that rotates refresh tokens may then answer `invalid_grant`, which marks the connection
  `reconnect_required`). While the transaction is open, another delivery for the same account waits on its row.
- `getSyncCursor(ctx, source)` returns the cursor or `null`. `advanceSyncCursor(ctx, { source, from, to })` is a
  compare-and-set: refused with `jobs.sync_cursor_moved` when the stored cursor is no longer `from`, so a slower
  worker cannot move it back; re-read and go on. Pass a transaction as `ctx.db` to move it with the batch's last write.
- `listSyncItems(ctx, { source?, status?, errorCode?, since?, limit? })` lists the ledger, most recently changed first
  (default 100, at most 1000): what passed, what failed and with which code, for an overview page or an MCP tool.
  `{ status: "pending", errorCode: "connections.reconnect_required" }` lists the items waiting on a reconnect, e.g. to
  enqueue the sync once the account is connected again.
- `reopenSyncItem(ctx, { source, itemId })` puts a `done`, `skipped` or `failed` item back to `pending` as never
  tried (attempts, code, result reference and finish time cleared), so the next `processSyncItem` runs it again; a
  `pending` item is returned as it is; `jobs.sync_item_not_found`. It breaks "at most once" for that item on purpose:
  call it only on an explicit operator action ("process this mail again"). Pass a transaction as `ctx.db` to reopen
  the item and enqueue the job that processes it in one commit:

  ```ts
  await db.transaction(async (tx) => {
    const reopened = await reopenSyncItem({ ...ctx, db: tx }, { source: "gmail.inbox", itemId });
    if (!reopened.ok) return reopened;
    await enqueueJob({ ...ctx, db: tx }, { queue: "gmail.process", payload: { itemId } });
    return reopened;
  });
  ```
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
| `requestJobCancel(ctx, id)` | a pending job becomes `cancelled`; a running one is asked to stop and ends `cancelled` (§3, "Progress and cancelling"); `jobs.not_cancellable` for a finished one, `jobs.not_found` |
| `getOwnJob(ctx, { id, ownerId })` | the `OwnJob` its owner sees; `jobs.not_found` for anyone else (§3, "A user follows their own job") |
| `requestOwnJobCancel(ctx, { id, ownerId })` | `requestJobCancel` for the job's owner; `jobs.not_found` for anyone else |
| `retryJob(ctx, id)` | a failed or cancelled job runs again from scratch (attempts 0, due now); `jobs.not_retryable`, `jobs.dedup_key_taken` while a live job has its key, `jobs.not_found` |
| `listRecentJobs(ctx, { statuses, queue?, limit? })` | jobs in any of `statuses` (a job status or `retrying`: pending after a failed attempt), most recently changed first, up to `limit` (default 50, at most 500) |
| `runScheduleNow(ctx, queue, { origin? })` | enqueues a run of the schedule now with its payload and dedup key (origin `manual` unless named), joining a pending run (`isDuplicate: true`); the schedule's own period is left alone; `jobs.not_a_schedule` |
| `retrySyncItem(ctx, { source, itemId })` | a `failed` ledger item back to `pending`, attempts and code cleared, so the next `processSyncItem` runs it; `jobs.sync_item_not_retryable`, `jobs.sync_item_not_found` |
| `reopenSyncItem(ctx, { source, itemId })` | a `done`, `skipped` or `failed` ledger item back to `pending` as never tried, for an explicit "process again"; a `pending` item unchanged; `jobs.sync_item_not_found` |
| `getQueueStats(ctx)` | per queue: counts per status, the due backlog, the `run_at` of its oldest due job and its `schedule` (or `null`) |
| `pruneJobs(ctx)` | deletes finished jobs past their retention; returns the count |
| `listJobRuns(ctx, { queue?, origin?, outcomes?, limit? })` | the run history, newest first (§3, "Run history") |
| `pruneJobRuns(ctx)` | deletes runs past `retention.runsDays`; returns the count |

`getQueueStats` suits an app health check of its own, `ops({ checks: { "app.jobs": … } })`, e.g. unavailable when the
oldest due job of a queue waited more than ten minutes (no worker is running). An ops script (`@softure-ai/ops/scripts`)
can wrap `retryJob` and `requestJobCancel` for the operator.

## 4. Mounting

The worker is a process (§3, "Running the worker"). The admin page is one file:

```ts
// app/admin/jobs/page.tsx
export { JobsPage as default } from "@softure-ai/jobs/next";
```

and its role check comes from `@softure-ai/auth`, passed in the config (jobs cannot import auth itself: auth depends on
jobs):

```ts
import { authorizeRole, requireRole } from "@softure-ai/auth/next";

jobs({ queues: { … }, panelRole: "admin", panelGuard: { requireRole, authorizeRole } });
```

The page shows, per queue, the counts per status and the oldest due job, and for a scheduled queue its period, last
success, last failure with its code, its health (`healthy`, `failing`, `late`) and **Run now**; then the 50 most
recently changed running, failed, cancelled and retrying jobs with code and attempts, a running job's progress (step,
counts, state code, when reported) and a requested cancel, with **Retry** (failed, cancelled) and **Cancel** (pending,
and running until a cancel was requested: `requestJobCancel`); then the 50 most recent runs with what started them, outcome, attempt, the summary's code, item counts
and steps, or the failure's code; then the 100 most recently changed sync ledger items per source with status, code, attempts and last
sighting, a status filter (`?sync=failed`) and **Retry item** on a failed item. Payloads and error texts never reach
the page: rows are built field by field and failures are codes. Anyone without `panelRole` gets Next's "not found";
every action checks the role again from the session before it reads its form.

An app with its own page shell composes the same parts: `getQueueStats`, `listRecentJobs`, `listJobRuns` and `listSyncItems`
from `/server`, `toJobsPanelData(source, messages, config)` and `getJobsMessages(config)` from `/next`, `JobsPanel` from
`/ui` (`classNames` per slot, `unstyled`; its runs section shows only when `runs` is passed), and the actions `runScheduleNowAction`, `retryJobAction`,
`cancelJobAction`, `retrySyncItemAction` from `/next`.

## 5. Migrations and tables

Schema `jobs`, five tables, `migrations/0001_create_jobs.sql`, `migrations/0002_create_schedules.sql`,
`migrations/0003_add_schedule_failures.sql`, `migrations/0004_create_sync_state.sql`,
`migrations/0005_add_schedule_reported_state.sql`, `migrations/0006_create_runs.sql`,
`migrations/0007_add_progress_and_cancel.sql` and `migrations/0008_add_owner_and_result_ref.sql`:

`jobs.jobs`: `id` (bigint identity; a string in the API), `queue`, `payload` (jsonb), `status` (`pending`, `running`,
`succeeded`, `failed`, `cancelled`), `attempts`, `max_attempts`, `run_at`, `locked_until`, `locked_by` (the worker,
`<hostname>:<pid>`), `claim_token`, `dedup_key`, `origin` (default `app`), `last_error` (an error code, never a
message), `created_at`,
`updated_at`, `finished_at`, `progress` (jsonb, code-only, checked by the module), `progress_at`,
`cancel_requested_at` (set only while `running` or once `cancelled`), `owner_id` (the user who follows the job,
indexed with `created_at`), `result_ref` (succeeded jobs only). Checks keep the lease columns set exactly while `running` and `finished_at` set exactly
for finished jobs; a partial unique index allows one live job per queue and dedup key.

`jobs.runs`: `id` (bigint identity), `job_id` (no foreign key: runs outlive pruned jobs), `queue`, `origin`,
`attempt`, `outcome` (`succeeded`, `retried`, `failed`, `cancelled`), `error_code` (set exactly when the outcome is
not `succeeded`), `summary` (jsonb,
successes only, checked by the module), `started_at` (null when unknown), `finished_at`.

`jobs.schedules`: `name` (the schedule's queue, primary key), `last_slot_at` (the start of the latest period a run
was enqueued for), `last_succeeded_at`, `last_failed_at`, `last_failure_code` (an error code, never a message),
`reported_state` (`healthy`, `failing` or `late`: the state `onScheduleStateChanged` last reported; default
`healthy`), `created_at`, `updated_at`. One row per schedule a worker has seen; a row of
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

`JobsPanel` uses `@softure-ai/ui` primitives (`Button`, `FormError`) and its `sft:` classes; the page wraps it in a
`Card`. Status colours come from the theme tokens (success, warning, danger). Slots: `root`, `section`,
`sectionTitle`, `lead`, `list`, `item`, `header`, `title`, `status`, `details`, `detail`, `actions`, `notice`,
`filter`, `filterLink`, `empty`.

## 9. Copy

`src/messages/en.ts`: the page (`page`, `queues`, `jobs`, `sync`) and `errors.*`, one key per error code's name
(`invalid_payload`, `handler_threw`, `lease_expired`, `not_found`, `not_cancellable`, `cancelled`, `not_retryable`,
`dedup_key_taken`, `sync_cursor_moved`, `sync_item_threw`, `not_a_schedule`, `sync_item_not_found`,
`sync_item_not_retryable`, and `forbidden`, `database_failed`, `unexpected` for `auth.forbidden` and the `core.*`
failures); `getJobsErrorMessage(messages, code)` picks one. An app overrides any of it with
`jobs({ messages: { en: { page: { title: "Workers" } } } })`.

## 10. Hooks

The handlers (§3) are the app's code. `logger` (`info`, `warn`, `error`; `@softure-ai/observability`'s `Logger` fits)
receives the worker's lines: started, stopped, a scheduled run enqueued, a thrown handler with its error, a lost lease,
a release, a job cancelled by an operator, an invalid or unstored progress, pruning, a failed alert hook, and one line per recorded attempt (`logRuns` picks which, default all):

| Outcome | Level and message | Fields |
|---|---|---|
| succeeded | `info` `job run succeeded` | `queue`, `jobId`, `attempt`, `origin`, `durationMs`, and the summary's `code` and `items` when the handler returned them |
| retried | `warn` `job run failed; retrying` | `queue`, `jobId`, `attempt`, `code`, `runAt` (ISO time of the next attempt) |
| failed | `error` `job run failed` | `queue`, `jobId`, `attempt`, `code` (an expired lease with no attempts left is `jobs.lease_expired`) |
| cancelled (`all` only) | `info` `job run cancelled` | `queue`, `jobId`, `attempt`, `code` (`jobs.cancelled`) |

Codes and ids only, never a payload or an error's text. An attempt whose write is refused (another worker took the
job over) leaves no line. `onJobFailed` and `onScheduleStateChanged` are the app's alert hooks (§3,
"Alert hooks").

## 11. GDPR

No export or deletion contributor: jobs are transient and pruned (§3, `retention`). Keep personal data out of
payloads (ids only); then a deleted account leaves nothing personal in `jobs.jobs`. `last_error` holds codes, and the
logger gets payload paths, never values, for a payload that does not match its schema. The sync ledger holds the
source's item ids, not their content; if an id is personal (an e-mail address), the app hashes it before passing it.
`owner_id` links a job to its user by the user's id, never a name or an e-mail address; an owned job is pruned like
any other once `retention.ownedDays` has also passed.

## 12. Limitations

- Polling, no `LISTEN/NOTIFY`: a job waits up to `pollIntervalMs` when the worker is idle.
- Schedules take a fixed period aligned to UTC (`every`) or times of day in a time zone (`at`), with
  calendar filters (`daysOfWeek`, `daysOfMonth`) on `at` schedules only; no cron expressions.
- No priorities within a queue and no rate limits per queue beyond `concurrency`; split work into queues instead.
- At-least-once delivery (§3, "Handlers run at least once").
- PGlite has one connection, so tests run claims one after another; concurrent claiming is Postgres behaviour
  (`SKIP LOCKED`) and is not exercised in unit tests.
