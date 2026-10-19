---
change_id: jobs-worker-heartbeat-610
title: "jobs/deploy: a health check that proves the worker's loop runs (issue #610)"
status: archived
roadmap_item: null
issue: 610
branch: claude/project-thread-pm4ru8
created: 2026-10-19
updated: 2026-10-19
archived_at: 2026-10-19
---

## Intent

Close [issue #610](https://github.com/SOFTURE/AI/issues/610) (labels `enhancement`, `pkg: jobs`, `pkg: deploy`), the
follow-up of #609: the `worker` service's health check (#609, PR #611) only proves that PID 1 is alive. A worker whose
loop is stuck (a hung claim query, a database connection it never gets back) still reports healthy. The worker should
prove that its loop runs: a heartbeat file it touches each round, a check the image runs with the tools it has, and
`softure-deploy init` using that check once the app's jobs version ships it.

## Context

jobs 0.1.2 is the latest on npm; #603 (PR #605) also changes jobs and #609 (PR #611) changes the worker's compose
health check; both merge first, so fresh master is merged in before this one merges. Releases are batched by the
coordinator: no version bump, the CHANGELOGs get `## Unreleased`. The app's `scripts/worker.ts` and compose file belong
to the app; the migration is described, never applied to an app's repository.

## Constraints

- Off by default: an app that passes no heartbeat file sees no change.
- The check needs only `node` (the image has no curl or procps) and runs as the image's user.
- `init` must never write a check the app's installed jobs version cannot answer: on an older jobs, `--health` would
  start a second worker instead of checking.

## Notes

- Framing: skipped. The issue names the problem and a three-part proposal.
