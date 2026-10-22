---
change_id: core-response-headers-652
title: "core: requestJson reads selected response headers, Retry-After and Link (issue #652)"
status: archived
roadmap_item: null
issue: 652
branch: claude/project-thread-lw8t7r
created: 2026-10-22
updated: 2026-10-22
archived_at: 2026-10-22
---

## Intent

Close [issue #652](https://github.com/SOFTURE/AI/issues/652): `requestJson` returns the parsed body or
`{ code, status }` and drops every response header. API clients need `Retry-After` on a 429 or 503 (the jobs
README already reads `reply.retryAfterSeconds`), pagination cursors in headers (`Link`, `X-Next-ID`) and rate-limit
budget headers. Give `requestJson` an explicit allow-list of headers to read, a parsed `retryAfterSeconds` on rate
limited and unavailable failures, and a `parseLinkHeader` helper.

## Context

Labels: `enhancement`, `pkg: core`. `requestJson` lives in `foundation/core/src/http-json.ts` (core 0.2.2). No
release in this change: the coordinator releases core in the next batch.

## Constraints

- No breaking change: without `readHeaders` the success value stays the body.
- Headers are read only by name from an allow-list, so nothing secret is surfaced by accident.
- A failure still carries no URL, header value outside the allow-list or caught error text.

## Notes

- Framing: skipped. The issue names the problem and the API.
