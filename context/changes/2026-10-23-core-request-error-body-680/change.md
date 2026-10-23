---
change_id: core-request-error-body-680
title: "core: requestJson reads the error answer's body through a schema (issue #680)"
status: in_progress
roadmap_item: null
issue: 680
branch: claude/project-thread-p39tv3
created: 2026-10-23
updated: 2026-10-23
---

## Intent

Close [issue #680](https://github.com/SOFTURE/AI/issues/680): `requestJson` cancels the body of every non-2xx answer,
so a caller cannot read what the provider wrote there (an OAuth `{"error":"invalid_grant"}`, Stripe's
`error.type`/`error.code`). Add an opt-in `errorSchema`: a failure that came with a 4xx, 429 or 5xx response carries
`errorBody`, the schema's output or `null`. Issue #677 waits for this to move `connections`' token calls and
`billing`'s Stripe checkout onto `requestJson`.

## Context

Labels: `enhancement`, `pkg: core`. Touches `foundation/core` only (`http-json.ts`, tests, README, CHANGELOG). No
release in this change: the coordinator releases in the next batch.

## Constraints

- Without `errorSchema` nothing changes: the body is cancelled and failures carry no `errorBody`, types included.
- Only the schema's output leaves; the schema's issues and the raw body never do.
- The read is bounded by the call's timeout.

## Out of scope

- `requestWithConnection` (`connections`) forwarding `errorSchema`: #677 decides whether it needs it.
- Moving `connections` and `billing` onto `requestJson`: issue #677.

## Notes

- Framing: skipped. The issue names the problem and the API.
