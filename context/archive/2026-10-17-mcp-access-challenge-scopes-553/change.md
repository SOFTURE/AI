---
change_id: mcp-access-challenge-scopes-553
title: "mcp-access: the 401 challenge names mcp:write while writes are allowed (issue #553)"
status: archived
roadmap_item: null
issue: 553
branch: claude/project-thread-m228dg
created: 2026-10-17
updated: 2026-10-17
archived_at: 2026-10-17
---

## Intent

Close [issue #553](https://github.com/SOFTURE/AI/issues/553): with `allowWrites: true` and OAuth on, an OAuth client
(claude.ai) only ever asks for `mcp:read`, because the endpoint's `401` challenge names `scope="mcp:read"` and the
MCP authorization spec tells clients to request the challenge's scope first. The consent page then never offers
writes. The challenge must name both scopes while writes are allowed, and a request with no `scope` should get the
server's default (both scopes while writes are allowed).

## Context

Labels: bug, pkg: mcp-access. mcp-access 0.2.2 is the latest on npm. Releases are batched by the coordinator: no
version bump here, the CHANGELOG gets `## Unreleased`.

## Constraints

- The person's tick on the consent screen still decides whether a grant writes.
- With `allowWrites` off nothing changes: the challenge names `mcp:read`, no write is offered.
- No change to stored grants: existing read-only grants stay read-only until the person reconnects.

## Notes

- Framing: skipped. The issue names the cause, the line and the fix.

## Decisions (auto)

- Take both proposals: the challenge names `mcp:read mcp:write` while `allowWrites` is on (OAuth on or off, the
  challenge is the same so a Bearer-only client sees the truth too), and a missing or blank `scope` on the
  authorization request is read as the default scope, which includes `mcp:write` exactly while `allowWrites` is on
  (RFC 6749 §3.3).
