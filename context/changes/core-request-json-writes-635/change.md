---
change_id: core-request-json-writes-635
title: "core: requestJson for write calls (POST, PUT, PATCH, DELETE), empty answers and http_conflict (issue #635)"
status: in_progress
roadmap_item: null
issue: 635
branch: claude/project-thread-jjudlr
created: 2026-10-21
updated: 2026-10-21
---

## Intent

Close [issue #635](https://github.com/SOFTURE/AI/issues/635): `requestJson` (#598) covers a JSON GET only. An app that
also writes to third-party APIs needs the same guarantees (timeout, no redirects, failures as codes that never quote
the URL or a key) for POST, PUT, PATCH and DELETE, with a JSON body, empty answers treated as success, a distinct code
for 409/412 and an optional `Idempotency-Key`.

## Context

Labels: `enhancement`, `pkg: core`. core 0.2.1 is the latest on master. Releases are batched by the coordinator: no
version bump here, the CHANGELOG gets `## Unreleased`.

## Acceptance

- `requestJson` takes `method` (`"GET"` default, `"POST" | "PUT" | "PATCH" | "DELETE"`), `body?: unknown` (sent as
  JSON with `content-type: application/json` unless the caller set one) and `idempotencyKey?: string` (sent as
  `Idempotency-Key`). `body` and `idempotencyKey` are typed for write methods only.
- A write answered 2xx with an empty body (204, or 200 with no content) returns `ok(undefined)`; a schema still
  validates a non-empty body. A GET with an empty body stays `core.http_unexpected_answer`.
- 409 and 412 return the new `core.http_conflict` with the status, for every method.
- Tests for each method, an empty 204, a conflict, and the "no failure carries the URL or a key" check with bodies.
- English copy for `errors.http_conflict`; README and CHANGELOG document it with the migration.

## Notes

- Framing: skipped. The issue states the problem and a concrete proposal.

## Decisions (auto)

- Extend `requestJson` instead of a sibling `sendJson`: one helper, one set of codes; `method` defaults to GET so
  existing calls are unchanged.
- The empty-answer success is for writes only. A GET that answers nothing has nothing to return, and keeping it an
  unexpected answer keeps the GET overload's type (`Ok<z.output<S>>`) exact. Writes with a schema return
  `Ok<z.output<S> | undefined>`.
- `ok(undefined)`, not `ok(null)`: `null` is a valid JSON body a schema may want to see.
- 409 and 412 are a conflict for GET too (a conditional GET with `If-Match`); before, a GET's 409 was an unexpected
  answer. Noted in the CHANGELOG.
- A body that `JSON.stringify` cannot serialise (a cycle, a BigInt) is a caller bug and throws, before any request.
