---
change_id: observability-non-error-reason-1142
title: "fix(observability): log the reason of a non-Error `error` instead of its typeof"
status: archived
roadmap_item: null
issue: 1142
branch: claude/project-thread-6ewh4q
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

An adopting app logged a refused provider call as `logger.warn("…", { error: "<provider answer>" })` and every
record read `exception.message="string"`: the reason was lost with nothing to show it was dropped. The outcome: in
`full` mode a non-Error `error` is logged by its text (a string as itself, other values by a safe, bounded
description); in `label` mode it is still not logged as free text, but the record says that the value was withheld,
and the README names the attribute route (`reason_code`, `status`) for a safe reason.

## Context

Issue #1142. `describeError` in `foundation/observability/src/errors.ts` returns
`{ "exception.type": typeof error, "exception.message": typeof error }` for anything that is not an `Error`, in
both modes.

## Constraints

- Backward compatible for `Error` values: their attributes do not change in either mode.
- `label` mode never logs free text of a non-Error value (string text, object JSON).
- The full-mode description is bounded in length and never throws (circular objects, BigInt).
- English only.

## Notes

- Framing: skipped. The issue names the defect, the asks and the done-when.

## Done

- `describeError` logs a non-Error `error` by its text in `full` mode (a string as itself, an object as its JSON,
  capped at 1000 characters) and as `non-Error <kind> (text|value withheld in label mode)` in `label` mode.
- README names the attribute route (`reason_code`, `status`); CHANGELOG; `@softure-ai/observability` 0.8.2.
