---
change_id: jobs-expected-failures
title: "jobs: failJob can mark a failure as expected, logged as a warning"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: null
branch: claude/project-thread-d2teps
created: 2026-11-18
updated: 2026-11-18
---

## Intent

Let a handler fail a job for a reason the app expects (input it refuses, a state it reports back to its user) without
an `error` log line, so log-based error alerts count only faults.

## Context

An adopting app's worker fails a preview job for good when the user's input does not fit (an overlay that does not
fit its frame). `logRunEnd` logs every terminal failure as `error` "job run failed", and the app's alert on error
lines (a run of errors in 15 minutes) counted three such refusals in a week as if the worker broke. The app's own
handler already logs the reason at `warn`.

## Scope

- `failJob(code, { expected: true })` and `FailJobOptions`; `JobFailure.isExpected`; the completion and the end line
  carry it; `logRunEnd` logs it at `warn` with `expected: true`.
- Unchanged: the job's status, `onJobFailed`, `onJobAttempt`, the breaker (a `failJob` is already permanent and not
  counted), run history, metrics.
- Tests, README, CHANGELOG; release as a patch (0.1.12), additive.

## Notes

- Research and frame skipped: the cause is one line of `run-log.ts`, read directly; the option is additive.
