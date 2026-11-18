---
change_id: ci-usage-time-budget
title: "ci-usage finishes a busy repository's report inside the job time"
status: plan_reviewed
roadmap_item: null
issue: 1366
branch: claude/project-thread-xvy7o9
created: 2026-11-18
updated: 2026-11-18
---

## Intent

The first report of a busy repository (SOFTURE/AI, about 1,150 runs a week, cold cache) ends inside the reusable
workflow's job timeout with a report, partial if it has to be, and saves the run cache so the next run goes further.
Today it is cancelled at 15 minutes with nothing published (issue #1366, run 44346286208).

## Context

- `collectRepository` reads each run's jobs one request after another, about one request a second.
- The reusable workflow has `timeout-minutes: 15`; a cancelled job saves neither the artifact nor the cache.
- The owner asked for a confirming release through the npm trusted publisher; this fix rides it as 0.1.1.

## Constraints

- Keep the request reserve and the "partial, never red" promise; the JSON schema stays `schemaVersion: 1`.
- No change in any app repository.

## Notes

- Frame skipped: the observation (a cancelled run) and its cause (sequential requests on a cold cache) are measured,
  and the fix is the one the README already promises.
