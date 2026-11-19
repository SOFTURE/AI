---
change_id: quality-review-round-4
title: "jobs, deploy: close the findings of the fourth 2026-11-19 quality review round"
status: archived
archived_at: 2026-11-19
roadmap_item: null
issue: null
branch: claude/project-thread-t8pq6z
created: 2026-11-19
updated: 2026-11-19
---

## Intent

Close the findings of the fourth review round at abd8232: jobs QR-b509138b, deploy QR-3cf76652 and QR-fb3573fe.

## Context

Asked in chat (no issue): the loop of review, fixes and re-review until the reports are clean. Same branch and pull
request as `quality-review-security-jobs-deploy`.

## Scope

- jobs `src/server/leased-run.ts`: check the lease end on every heartbeat tick; never send a heartbeat while one is
  still waiting for its answer.
- deploy `src/integration/run-integration.ts`, `cli/integration-command.ts`: `lookupIntegration` returns the fetch
  failure; `lookup` says it reads local notes, and exits 1 when nothing is stored locally; `run` logs a failed main
  branch fetch.
- deploy `src/cli/run.ts`: an unexpected error ends with one line and exit 1, never a stack trace.
- README and CHANGELOG of both.

## Notes

- Frame and research skipped: every finding names its cause, file and fix; the report is the research.

## Decisions (auto)

- An unreachable remote with a note stored locally keeps exit 0 or 1 by the stored result (with a stderr line), as
  the local fallback was documented; only "nothing stored and unreachable" changes from 3 to 1.
- The unexpected error line prefers a child process's last stderr line (git's `fatal:` line) over the Node message,
  which repeats the whole command line.

## Done

- On master with the next releases: jobs and deploy (with `quality-review-security-jobs-deploy`).
