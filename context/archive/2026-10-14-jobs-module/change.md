---
change_id: jobs-module
title: "Apps run background work from a Postgres queue with leases, retries and a worker process (issue #471)"
status: archived
roadmap_item: null
issue: 471
branch: claude/project-thread-5doca7
created: 2026-10-14
updated: 2026-10-14
archived_at: 2026-10-14
---

## Intent

An app that must do slow or unreliable work after a request (an AI call per received message, a provider call that
may fail) enqueues a job in the same transaction as its own write and lets a separate worker process run it, with
retries and a terminal failure state, without building its own queue table, claim query, lease expiry, fencing and
shutdown handling. Delivered as a new package, `@softure-ai/jobs`, plus the worker container in the deploy recipe.

## Context

- Issue #471 (labels `enhancement`, `new package`), filed while adopting the packages in an app that built its own
  domain table with job state and a local `scripts/worker.ts` loop.
- The owner accepted the new package on 2026-10-14 in the project chat ("471, masz akcepta"), and noted that
  existing packages lack this foundation too (billing reminders run from cron, mailing keeps its own retry ledger,
  the blog pings IndexNow synchronously). Those refactors are separate issues, filed after this change merges.
- Must fit `@softure-ai/db` (migrator, `createTestDatabase`), `@softure-ai/ops` (health), `@softure-ai/deploy`
  (a second container from the same image) and `@softure-ai/observability` (its `Logger`).

## Constraints

- Owns `modules/jobs/` (new) and the worker part of `tools/deploy` (`src/init/`, `templates/`, README, CHANGELOG).
- Does not touch billing, mailing or blog: their refactors are follow-up issues.
- No release in this change: the coordinator releases (`release.owner: false`); a brand-new package needs
  `NPM_TOKEN` for its first npm publish (scripts/release/README.md).
- Everything in English.

## Notes

- Framing: skipped. The issue names the problem, the owner accepted the solution shape.
