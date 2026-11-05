---
change_id: mcp-access-request-diagnostics-1066
title: "mcp-access: opt-in request diagnostics in createMcpEndpoint and a documented answer for stale hosted tool lists (issue #1066)"
status: active
roadmap_item: null
issue: 1066
branch: claude/project-thread-ra4dxp
created: 2026-11-05
updated: 2026-11-05
---

## Intent

Close [issue #1066](https://github.com/SOFTURE/AI/issues/1066): a hosted client (a claude.ai custom connector) keeps
showing a tool list several releases old, although the served `tools/list` is current, the version follows it (#877)
and sessions follow the version (#1055). The endpoint logs nothing about successful requests, so what the client
actually sends cannot be seen.

## Context

Labels: bug, pkg: mcp-access (found in an adopting app). `@softure-ai/mcp-access` 0.5.0, `@modelcontextprotocol/server`
2.4.0, protocol `2025-06-18`. No version bump: the coordinator releases.

## Scope

- An opt-in `diagnostics` option on `createMcpEndpoint` (and so on `createMcpRoute`): one entry per request with the
  JSON-RPC method, the tool name of a `tools/call`, the session state (none, current, stale, not issued, unchecked),
  the version a stale session carries, the served tool list version, whether `initialize` got a session id, the
  answer status and, on `initialize`, the client's `clientInfo` name and version and the requested protocol version.
- No token, body, argument value, session id or user identity in an entry.
- README: what hosted clients do with a changed tool list, from public evidence, and what the user and the server
  can do about it.

## Constraints

- Off by default; without the option nothing changes, not even an extra body read.
- Owns `modules/mcp-access` only.

## Notes

- Framing: skipped. The issue states the problem, the fields and the acceptance.
