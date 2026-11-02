---
change_id: jobs-db-outage-logs-933
---

# Research

## Where the loop logs database failures

`modules/jobs/src/worker/run-job-worker.ts` (jobs 0.1.6):

| Call | Line today |
| --- | --- |
| `enqueueScheduledRun` (per schedule, per round) | `error: could not enqueue a scheduled run; trying again next round` |
| `checkScheduleStates` (once a minute) | `error: could not check schedule states` |
| `claimJobs` (per queue, per round) | `error: could not claim jobs` |
| `pruneJobs`, `pruneJobRuns`, `pruneSyncItems` (hourly) | `error: could not prune ...` |
| `extendJobLease` (heartbeat per running job) | `error: could not extend a job lease` |
| `runClaimedJob` rejecting (outcome recording) | `error: could not record a job outcome; ...` |
| `releaseJob` in `stop()` | `error: could not release a job; ...` |

The claim loop tries every queue even after the first failure, so an app with 21 queues writes up to 21 lines per
round. The health file is touched only after a round in which no claim failed, so a lasting outage already makes
`--health` fail.

## How the errors look

- `pg` (node-postgres) server errors carry `code` (SQLSTATE): `57P01 admin_shutdown`, `57P02 crash_shutdown`,
  `57P03 cannot_connect_now`, class `08` connection exceptions (`08000`, `08003`, `08006`, `08001`, `08004`).
- Socket errors carry a Node `code`: `ECONNREFUSED`, `ECONNRESET`, `EPIPE`, `ETIMEDOUT`, `EHOSTUNREACH`,
  `ENETUNREACH`, `ENOTFOUND`, `EAI_AGAIN`; a connect to several addresses can fail with an `AggregateError` whose
  `errors` hold them.
- `pg` and `pg-pool` errors without a code: `Connection terminated unexpectedly`, `Connection terminated`,
  `Client has encountered a connection error and is not queryable`, `timeout exceeded when trying to connect`.
- Drizzle wraps a failed query as `Failed query: ...` with the driver error in `cause`
  (`foundation/core/src/safe-error.ts` already reads the SQLSTATE from `error.cause`).

No package exports such a check today (`grep` over `foundation/` and `modules/`).

## Tests

`modules/jobs/tests/worker.test.ts` runs the loop on PGlite with a recording logger; a failing database is simulated
by a `Queryable` whose `query`/`execute` rejects.
