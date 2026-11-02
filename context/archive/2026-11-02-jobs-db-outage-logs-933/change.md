---
change_id: jobs-db-outage-logs-933
title: "jobs: a short database outage is logged below warning by the worker, and a round stops claiming after the first such failure (issue #933)"
status: archived
roadmap_item: null
issue: 933
branch: claude/project-thread-824q3f
created: 2026-11-02
updated: 2026-11-02
archived_at: 2026-11-02
---

## Intent

Close [issue #933](https://github.com/SOFTURE/AI/issues/933): when the database goes away for a moment (a host restart
stops Postgres a moment before the worker gets SIGTERM), `runJobWorker` logs one `error` line per queue and per
database call of the loop. An app that alerts on error lines gets an alert for every planned restart.

Expected: a failure caused by the database being unavailable (SQLSTATE 57P01 to 57P03, class 08, a refused or closed
connection) is logged as `info` while the outage is short, and as `error` once it lasts longer than a tolerance
(default one minute). A round stops claiming after the first such failure instead of trying every remaining queue.

## Context

Labels: `bug`, `pkg: jobs`. Issue #934 (a log line per finished run) changes `src/server/process.ts` in parallel;
this change stays in `src/worker/`. No release in this change: the coordinator releases the batch.

## Constraints

- Every other failure keeps its `error` line exactly as before.
- The health file keeps guarding a worker that stays cut off from the database (no change to when it is touched).
- No change to any app repository.

## Notes

- Framing: skipped. The issue names the problem, the cause and the expected behaviour.
