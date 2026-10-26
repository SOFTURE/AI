---
change_id: jobs-run-history-803
title: "jobs: keep a run's result summary and what started it, beyond the succeeded-job retention (issue #803)"
status: archived
roadmap_item: null
issue: 803
branch: claude/project-thread-fa43ml
created: 2026-10-26
updated: 2026-10-26
archived_at: 2026-10-26
---

## Intent

Close [issue #803](https://github.com/SOFTURE/AI/issues/803): `@softure-ai/jobs` drops what a handler returns with
`ok(...)`, records nothing about what started a job, and prunes succeeded jobs after `retention.succeededDays`. An app
that shows its operator a runs history keeps its own run table and wraps every handler. Give the module that history:
an optional code-only run summary a handler returns, an `origin` on `enqueueJob` / `runScheduleNow`, a run history with
its own retention, and a read plus an admin page section that show the summary and the origin.

## Context

- Labels: `enhancement`, `pkg: jobs`.
- PR #799 (issue #785) changes the jobs README too; this change merges after it, with master merged in.

## Constraints

- Codes and counts only, never payloads or error texts, as the rest of the module.
- Additive: existing handlers, callers and apps that compose `JobsPanel` keep working unchanged.
- English only; no version bump (the coordinator releases).

## Notes

- Framing: skipped. The issue names the gap and the four asks.

## Before the next release

- jobs gets a minor-level change (new migration 0006, new API) but is released as a patch while other packages depend
  on `^0.1.x` of it; the coordinator decides at release time.
