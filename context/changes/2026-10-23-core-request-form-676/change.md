---
change_id: core-request-form-676
title: "core: requestJson sends form bodies, URL-encoded and multipart (issue #676)"
status: in_progress
roadmap_item: null
issue: 676
branch: claude/project-thread-e00l8d
created: 2026-10-23
updated: 2026-10-23
---

## Intent

Close [issue #676](https://github.com/SOFTURE/AI/issues/676): `requestJson` serialises every write body with
`JSON.stringify`, so APIs that answer JSON but take `application/x-www-form-urlencoded` (OAuth token endpoints,
Stripe) or `multipart/form-data` (file uploads) need a hand-written copy of its rules. A `FormData` passed as `body`
is silently sent as `{}`. Add a `form: URLSearchParams | FormData` write option, reject non-JSON values in `body`,
let `requestWithConnection` pass `form` through and let `fakeFetch` record form fields and file parts.

## Context

Labels: `enhancement`, `pkg: core`. Touches `foundation/core` (`http-json.ts`), `modules/connections` (tests and
docs only; issue #675 changes `request.ts` in parallel) and `foundation/testing` (`fake-fetch.ts`). No release in
this change: the coordinator releases in the next batch.

## Constraints

- No breaking change for calls that send a JSON `body` or none.
- The answer is read exactly as before (schema, empty write answer, status codes, `readHeaders`, `idempotencyKey`).
- A multipart `content-type` is never set by hand: `fetch` adds it with the boundary.

## Out of scope

- Non-JSON answers (binary downloads), streaming uploads.
- Moving `connections`' `postForm` and the Stripe checkout call onto `form`: a follow-up issue.

## Notes

- Framing: skipped. The issue names the problem and the API.
