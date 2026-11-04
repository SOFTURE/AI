---
change_id: mcp-access-tool-list-session-1055
title: "mcp-access: a session tied to the tool list version makes a connected client re-list tools (issue #1055)"
status: open
roadmap_item: null
issue: 1055
branch: claude/project-thread-ot9pgn
created: 2026-11-04
updated: 2026-11-04
---

## Intent

Close [issue #1055](https://github.com/SOFTURE/AI/issues/1055): after a release that changes a tool's schema or
description, a client that is already connected to the MCP endpoint re-lists the tools on its next request, without
the user reconnecting the connector.

1. The endpoint issues an `Mcp-Session-Id` at `initialize` that carries the tool list version of the identity's access
   level; nothing is stored, so the endpoint stays stateless across instances.
2. A later request whose session id carries another version answers `404 Not Found`, which the Streamable HTTP spec
   defines as "start a new session": the client initializes again and lists the tools again.
3. The `initialize` answer declares `tools.listChanged: false`, since the endpoint never sends the notification.
4. A `/testing` helper next to `measureServedToolLists` asserts that a changed tool list renews an old session.

## Context

- Labels: `enhancement`, `pkg: mcp-access`. Follows #877 (tool list version) and #885 (`get_server_info`).
- Versions: `@softure-ai/mcp-access` 0.4.0 on npm, `@modelcontextprotocol/server` 2.3.0 in the lockfile.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- Stateless clients (no session id) behave exactly as today.
- Hand-written factories keep working; sessions need a factory that can tell the version
  (`createMcpServerFactory`, or a `toolListVersion` reader on the endpoint).

## Notes

- Framing: skipped. The issue names the problem, the two options and the acceptance.

## Decisions (auto)

- Option 1 only (sessions keyed to the version, 404 on another version). Option 2 (`list_changed` on an SSE answer)
  would have to keep serving a stale session to deliver it, and the 404 already makes the client re-initialize and
  re-list, with a path the spec defines for every client.
- `tools.listChanged` is rewritten to `false` in the endpoint's `initialize` answer for every factory, because no
  endpoint answer ever carries the notification.
- The session id is `<base64url(version)>.<32 hex random>`: opaque, visible ASCII whatever a fixed `version` holds.
- The version reader is the factory's own `toolListVersion(identity)` (attached by `createMcpServerFactory`), with an
  optional `toolListVersion` endpoint option for hand-written factories.
