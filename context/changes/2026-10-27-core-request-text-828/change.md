---
change_id: core-request-text-828
title: "core: a text (HTML) counterpart of requestJson with the same failure codes (issue #828)"
status: in_progress
roadmap_item: null
issue: 828
branch: claude/project-thread-micwuo
created: 2026-10-27
updated: 2026-10-27
---

## Intent

Close [issue #828](https://github.com/SOFTURE/AI/issues/828): `@softure-ai/core` reads JSON (`requestJson`) and bytes
(`requestBytes`) but not a text page. An app that reads one public HTML page writes its own `fetch` wrapper with a
timeout, redirect handling, the final URL, `404/410` as "no page" and the mapping of statuses to the `core.http_*`
codes. Add `requestText` with the same codes, timeout, `Retry-After` parsing and a body cap, built on the code of
`requestBytes` rather than a copy.

## Context

Labels: `enhancement`, `pkg: core`. No release in this change: the coordinator releases in the next combined release.

## Constraints

- Same failure union as `requestBytes` (`core.http_*` plus `core.http_too_large`), same `Retry-After` parsing.
- The body cap is enforced while streaming (shared with `requestBytes`, not a copy).
- No caught error message, URL or body reaches a failure.
- `requestJson` and `requestBytes` behave exactly as before.

## Notes

- Framing: skipped. The issue names the problem and the API.
