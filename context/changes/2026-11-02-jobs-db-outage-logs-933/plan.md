---
change_id: jobs-db-outage-logs-933
status: in_progress
---

# Plan: a short database outage is logged below warning by the worker (issue #933)

Input: change.md, research.md. Complexity: small (one package, the worker loop, docs).

## Phase 1: tell an outage from any other failure (TDD)

Files: `modules/jobs/src/server/database-unavailable.ts`, `modules/jobs/src/server/index.ts`,
`modules/jobs/tests/database-unavailable.test.ts`.

1. `isDatabaseUnavailableError(error: unknown): boolean`: true for SQLSTATE `57P01`, `57P02`, `57P03` and class `08`,
   for the socket codes `ECONNREFUSED`, `ECONNRESET`, `EPIPE`, `ETIMEDOUT`, `EHOSTUNREACH`, `ENETUNREACH`,
   `ENOTFOUND`, `EAI_AGAIN`, and for the `pg`/`pg-pool` connection messages without a code; it looks through `cause`
   and `AggregateError.errors` (a few levels deep, so a cycle cannot loop). Anything else, including a non-error, is
   false. Exported from `/server` for an app's own loop.

## Phase 2: the worker logs an outage below warning while it is short (TDD)

Files: `modules/jobs/src/worker/database-outage.ts`, `modules/jobs/src/worker/run-job-worker.ts`,
`modules/jobs/src/worker/process.ts`, `modules/jobs/tests/worker.test.ts`.

1. `createDatabaseOutage({ clock, logger, toleranceMs })`: `fail(message, fields)` logs an unavailable-database
   failure as `info` with `outageMs` while the outage (since its first such failure) is shorter than `toleranceMs`, and
   as `error` once it is not; any other failure stays `error`. `recover()` after a database call that succeeded ends
   the outage with one `info: database reachable again` line (`outageMs`). Returns whether the failure was an outage.
2. Every database failure of the loop goes through it (enqueue, schedule check, claims, prunes, lease extension,
   outcome recording, release on stop); the successful calls call `recover()`.
3. A round stops claiming after the first unavailable-database failure (the remaining queues wait for the next
   round); the health file stays untouched in that round as before.
4. `RunJobWorkerOptions.databaseOutageToleranceMs` (default 60 000; `0` logs every such failure as `error`, as
   before); `runJobWorkerProcess` passes it through.
5. Tests on PGlite with a database that rejects with `57P01` on demand: a short outage writes no warn or error line,
   one claim attempt per round only, and `database reachable again` after it; an outage past the tolerance writes
   `error`; a failure that is not an outage stays `error`.

## Phase 3: docs

jobs README (worker section: how an outage is logged, the option), CHANGELOG `## Unreleased`.

## Decisions (auto)

- `info` (not `warn`) while short: the issue asks for below warning, and the worker recovers on its own.
- The tolerance counts from the first failure of the outage, not per call, so a lasting outage turns every line back
  into `error` after one minute, and the health file still turns the container `unhealthy`.
- A worker option, not a jobs config key: it is about the process and its logs, like `heartbeatMs` and `healthFile`.
- The classifier lives in `/server` (exported), so an app with its own loop or wrapper reuses it.
- No version bump: the coordinator releases.

## Progress
