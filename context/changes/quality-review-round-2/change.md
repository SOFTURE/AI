---
change_id: quality-review-round-2
title: "jobs, deploy: close the findings of the second 2026-11-19 quality review round"
status: planned
roadmap_item: null
issue: null
branch: claude/project-thread-t8pq6z
created: 2026-11-19
updated: 2026-11-19
---

## Intent

Close the findings of the second review round at f904ce97: jobs QR-eb6c9b7c (the cancel request), deploy
QR-412d3f32, QR-6d829ea5, QR-5e339e2d, QR-f53d72f5 and QR-cdf5c7a5. The security review of that commit was clean.

## Context

Asked in chat (no issue): the loop of review, fixes and re-review until the reports are clean. Same branch and pull
request as `quality-review-security-jobs-deploy`.

## Scope

- jobs `src/react/use-job-status.ts`: `cancel` gets the poll's time limit and the unmount signal; a timeout is `network`.
- deploy `src/db/connection.ts`: query, statement and lock time limits on the client.
- deploy `src/db/row-counts.ts`: `countRows` refuses a name that is not a table name.
- deploy `src/integration/git-notes.ts`: network git commands have a time limit; a refused fetch or push carries
  git's last stderr line (credentials in URLs masked); the notes push retries only on a non-fast-forward refusal.
- deploy `src/notes/git.ts`: `findPreviousTag` returns null only when no matching tag is merged; other git failures
  propagate.
- README and CHANGELOG of both.

## Notes

- Frame and research skipped: every finding names its cause, file and fix; the report is the research.

## Decisions (auto)

- Database time limits: statement 10 min, lock 30 s, client query 11 min: generous for a `count(*)` of a large
  table, bounded for a lock held by a parallel migration.
- Git network time limit: 2 min per command, enough for a notes fetch on a slow runner.
- A refused push's reason is git's last stderr line, at most 200 characters, with `//user:secret@` masked.
