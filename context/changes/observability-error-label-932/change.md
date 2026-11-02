---
change_id: observability-error-label-932
title: "observability: a failed request is identifiable in label mode (issue #932)"
status: in_progress
roadmap_item: null
issue: [932]
branch: claude/project-thread-co3etq
created: 2026-11-02
updated: 2026-11-02
---

## Intent

Close [issue #932](https://github.com/SOFTURE/AI/issues/932): with `errorDetails: "label"`, `onRequestError` logs
`exception_type=Error exception_message=Error` and no trace id, so a failed render cannot be told apart from any other
plain `Error`. Keep the label rule (nothing of any message is logged) and add what is safe and identifying: the top
app frames, the kinds and safe codes of the cause chain, and Next's hashed digest. Document why the record carries no
trace id on Next's RSC payload path.

## Context

Labels: none yet (no `pkg: observability` label exists). Package: `foundation/observability` 0.4.1. Checked first that
no other session shipped it: nothing on master (7d0dc3b) mentions #932, no branch or pull request for it. No version
bump: the coordinator releases the batch.

## Constraints

- Label mode never writes any part of an error message, of the cause's message, or a `NEXT_*` digest.
- `full` mode stays as it is.
- The adopting app is not changed here; the closing comment says what it gains.

## Notes

- Framing: skipped. The issue names the problem, the asks and the acceptance.
