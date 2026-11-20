---
change_id: quality-review-round-5
title: "jobs, deploy: close the findings of the fifth 2026-11-19 quality review round"
status: archived
archived_at: 2026-11-19
roadmap_item: null
issue: null
branch: claude/project-thread-t8pq6z
created: 2026-11-19
updated: 2026-11-19
---

## Intent

Close the findings of the fifth review round at bdec653: jobs QR-0d2ff376 (suggestion) and deploy QR-8beb1473
(warning, the fetch before the push).

## Context

Asked in chat (no issue): the loop of review, fixes and re-review until the reports are clean. Same branch and pull
request as `quality-review-security-jobs-deploy`.

## Scope

- jobs tests: the one-week cap of `retryJobLater` and `pauseQueueLater`; README names the cap.
- deploy `src/integration/run-integration.ts`: a failed notes fetch before the push ends `unreachable`; test with a
  remote whose first fetch fails.
- deploy CHANGELOG.

## Notes

- Frame and research skipped: both findings name their cause, file and fix; the report is the research.

## Decisions (auto)

- A failed fetch before the push stops the run instead of starting it on a stale baseline: the run has not started,
  so exit 1 with "the run did not start" is accurate and the caller retries.

## Done

- On master with the next releases: jobs and deploy (with `quality-review-security-jobs-deploy`).
