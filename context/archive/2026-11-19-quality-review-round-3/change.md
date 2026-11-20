---
change_id: quality-review-round-3
title: "jobs, deploy: close the findings of the third 2026-11-19 quality review round"
status: archived
archived_at: 2026-11-19
roadmap_item: null
issue: null
branch: claude/project-thread-t8pq6z
created: 2026-11-19
updated: 2026-11-19
---

## Intent

Close the findings of the third review round at 6111acc: jobs QR-e566b3cd and QR-092a905c, deploy QR-8a3e50b2,
QR-8beb1473, QR-d059642b and QR-fa30200a. The security review was clean since round 2.

## Context

Asked in chat (no issue): the loop of review, fixes and re-review until the reports are clean. Same branch and pull
request as `quality-review-security-jobs-deploy`.

## Scope

- jobs `src/server/leased-run.ts`: abort the handler once its lease ran out while every heartbeat failed.
- jobs `src/server/queue-state.ts`: `pauseQueueForHandler` never replaces an operator's pause, timed or not.
- deploy `src/db/backup.ts`: `pg_dump` lock wait limit, default connect timeout, overall kill timer.
- deploy `src/integration/run-integration.ts`, `git-notes.ts`, `cli/integration-command.ts`: the wait loop logs
  failed fetches and ends `wait-unreachable` when no fetch reached the remote; the main branch fetch and the read of
  its note are separate functions; a remote without notes counts as reached.
- deploy tests: the race retry and the attempts limit of `recordIntegration`.
- README and CHANGELOG of both.

## Notes

- Frame and research skipped: every finding names its cause, file and fix; the report is the research.

## Decisions (auto)

- The local lease end is the claim's `lockedUntil`, then the time each successful heartbeat was asked plus the lease:
  never later than the stored lease, so the handler stops no later than another worker could claim the job.
- pg_dump limits: lock wait 30 s (as the other database steps), connect 10 s unless the URL sets one, 60 minutes in
  all; `timeoutMs` stays a library option, no CLI flag.
- A wait that never reached the remote exits 1 with its own message, since the run may still be in progress; once one
  fetch succeeded, a later outage still ends as the usual timeout (75).
- `findMainNoteText` was internal (not exported), so its split needs no changelog migration line.

## Done

- On master with the next releases: jobs and deploy (with `quality-review-security-jobs-deploy`).
