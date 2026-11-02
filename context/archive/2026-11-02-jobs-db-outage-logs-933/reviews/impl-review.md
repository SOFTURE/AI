---
change_id: jobs-db-outage-logs-933
verdict: approved
---

# Implementation review

Reviewed the diff of p1 to p3 against plan.md and change.md.

- Plan followed: `isDatabaseUnavailableError` in `/server` (closed list of SQLSTATEs, socket codes and `pg` messages,
  through `cause` and `AggregateError.errors`, depth-limited); `createDatabaseOutage` in the worker; every database
  failure of the loop goes through it (enqueue, schedule check, claims, three prunes, lease extension, outcome
  recording, release on stop) and every success ends an outage; the claim loop breaks at the first outage failure;
  `databaseOutageToleranceMs` on `runJobWorker` and `runJobWorkerProcess`.
- Constraints: other failures keep `error` (tested with SQLSTATE 42P01, all queues still tried); the health file is
  still touched only after a round without a failed claim, so a lasting outage still fails `--health`.
- Tests: 31 classifier cases (both sides, wrapped, aggregate, cycle); four worker tests on PGlite with a switchable
  database handle. The two outage-level tests fail on master's loop and pass now; run three times, stable.
- Language gate, typecheck and ESLint green on every commit; jobs and repository tests green.
- No version bump (the coordinator releases); CHANGELOG under `## Unreleased` with a migrate line.

Verdict: approved, no changes.
