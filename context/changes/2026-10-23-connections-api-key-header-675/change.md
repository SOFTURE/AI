---
change_id: connections-api-key-header-675
title: "connections: API keys in a custom header or with a scheme other than Bearer (issue #675)"
status: open
roadmap_item: null
issue: 675
branch: claude/project-thread-nyz2r8
created: 2026-10-23
updated: 2026-10-23
---

## Intent

Close [issue #675](https://github.com/SOFTURE/AI/issues/675): every `api_key` credential is sent as
`Authorization: Bearer <key>`, so a provider that reads the key from `x-api-key` (or another vendor header) or from
`Authorization: Token <key>` cannot use `requestWithConnection`, and its 401 to the wrong header marks a valid key
`reconnect_required`. Let an `api_key` provider declare where its key goes (`header: { name, scheme? }`), have
`requestWithConnection` send it there, and give an app with its own HTTP client the same placement as `{ name, value }`.

## Context

Labels: `enhancement`, `pkg: connections`. No release in this change: the coordinator releases connections in the
next combined release. Issue #676 (core `form` bodies) touches `requestWithConnection` in parallel; whoever merges
second merges the other in.

## Constraints

- Additive: without `header` an `api_key` provider behaves exactly as before (`Authorization: Bearer <key>`).
- The 401 rule of `requestWithConnection` is unchanged.
- A header name is an RFC 9110 token; `scheme` is allowed only with `authorization`.
- No secret reaches an error, a log line or a thrown message (headers stay a list of pairs).
- Out of scope: keys in the query string, request signing (HMAC).

## Notes

- Framing: skipped. The issue names the problem and the API.
