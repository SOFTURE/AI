---
change_id: jobs-attempt-hook-1215
title: "jobs: a per-attempt outcome hook so an app can count every queue's runs by status (issue #1215)"
status: archived
roadmap_item: null
issue: 1215
branch: claude/project-thread-tts7yp
created: 2026-11-09
updated: 2026-11-09
archived_at: 2026-11-09
---

## Intent

Close [#1215](https://github.com/SOFTURE/AI/issues/1215). An adopting app charts every queue's runs by outcome and
duration without wrapping its handlers and re-deriving the worker's classification: the jobs module reports each
recorded attempt with the outcome the worker itself decided.

## Context

Labels: `enhancement`, `pkg: jobs`. `@softure-ai/jobs` 0.1.8 reports only terminal failures (`onJobFailed`), pauses
and schedule health.

## Constraints

- jobs depends on no telemetry package and never on auth.
- Codes and ids only in the event, like `JobFailedEvent`.
- A throwing hook never changes a job's outcome.

## Notes

- Framing: skipped. The issue names the problem and two acceptable outcomes.

## Done

`@softure-ai/jobs` 0.1.9 (#1215): new option `onJobAttempt(event, ctx)` runs once per attempt the worker or
`runDueJobs` recorded, with `{ queue, jobId, origin, attempt, maxAttempts, outcome, code, durationMs, at }` and the
worker's own classification (`succeeded`, `retried`, `failed`, `paused`, `cancelled`). `recordJobHooks()` records it as
`attempts`. README §3 "Per-attempt metrics" shows the OpenTelemetry counter and histogram an app sets up with it.
