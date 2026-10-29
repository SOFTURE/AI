---
change_id: mcp-access-tool-list-version-877
title: "mcp-access: server version that follows the tool list (issue #877)"
status: in_progress
roadmap_item: null
issue: 877
branch: claude/project-thread-5dqqgr
created: 2026-10-29
updated: 2026-10-29
---

## Intent

Close [issue #877](https://github.com/SOFTURE/AI/issues/877): MCP clients keep a cached `tools/list` until the server
version they read at `initialize` changes. Give `@softure-ai/mcp-access/server` a `measureToolList(registerTools)` that
fingerprints the tool list as a client reads it (`<release>-tools-<12 hex>`, plus the tool count), and a server factory
that serves that version as `serverInfo.version` by default, measured per access level, with an option for the release
part. A testing helper reports the versions an app's factory serves, for a snapshot that changes when a schema does.

## Context

Labels: `enhancement`, `pkg: mcp-access`. Issue #876 (strict tool input) extends the same factory and starts after this
one merges. No version bump: the coordinator releases the batch.

## Constraints

- Backwards compatible: apps that build their own `McpServer` keep working; everything is new API.
- Deterministic: the same registrations give the same version; any change of name, description or schema changes it.

## Notes

- Framing: skipped. The issue names the gap, the version shape and the adopting app's workaround.
