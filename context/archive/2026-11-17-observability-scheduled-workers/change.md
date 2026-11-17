---
change_id: observability-scheduled-workers
title: "observability: export the logs of a Worker's scheduled runs"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-be2get
created: 2026-11-17
updated: 2026-11-17
archived_at: 2026-11-17
---

## Intent

Let an app on Cloudflare Workers export the logs and a span of its Cron Trigger runs (the jobs tick), so a Grafana
rule on the logs can tell a dead Cron Trigger from a quiet one.

## Context

Gap met by an adopting app that alerts when no jobs tick succeeded for ten minutes: `withObservability` wraps only
`fetch`, so records written by the `scheduled` handler waited for the next request's export (at most 100) or were
never sent. Fixed here directly and kept generic (owner's standing order for adopting apps).

## Scope

- `withScheduledObservability(handler, options)` in `@softure-ai/observability/workers`, sharing the record collector
  and the export with `withObservability`.
- Patch release 0.8.7 (additive).

## Done

- Wrapper, 3 tests in `tests/workers.test.ts`, README section and limitation, CHANGELOG 0.8.7.
