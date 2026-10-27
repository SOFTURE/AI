---
change_id: connections-download-824
title: "connections: download a binary body with a stored connection (issue #824)"
status: open
roadmap_item: null
issue: 824
branch: claude/project-thread-he8ygz
created: 2026-10-27
updated: 2026-10-27
---

## Intent

Close [issue #824](https://github.com/SOFTURE/AI/issues/824): `requestWithConnection` only reads JSON, so an app that
downloads a file (an invoice PDF, a report PDF) with a connected account's credential writes its own copy of the
credential header, the timeout, the redirect rule, the 401 handling and core's status mapping, and usually skips the
OAuth refresh-and-retry. Add `downloadWithConnection` in `/server` and `/next` with the same credential handling,
refresh and 401 rules and error codes, returning the bytes as a `Uint8Array` with the response's `content-type`, and
refusing a body above a size cap.

## Context

Labels: `enhancement`, `pkg: connections`. No release in this change: the coordinator releases in the next combined
release.

## Constraints

- Same credential, refresh-once and 401 rules as `requestWithConnection` (one implementation, not a copy).
- Same failure codes (`core.http_*`, `connections.*`); a too large body is refused before it is buffered whole.
- No secret, URL or caught error message reaches a result or a thrown message.
- `requestJson` and `requestWithConnection` behave exactly as before.
- A fake-friendly `fetch` option, like `requestWithConnection`.

## Notes

- Framing: skipped. The issue names the problem and the API.
