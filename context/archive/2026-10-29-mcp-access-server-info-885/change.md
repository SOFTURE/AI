---
change_id: mcp-access-server-info-885
title: "mcp-access: optional get_server_info tool over the ops build info (issue #885)"
status: archived
roadmap_item: null
issue: 885
branch: claude/project-thread-24nqkb
created: 2026-10-29
updated: 2026-10-29
archived_at: 2026-10-29
---

## Intent

Close [issue #885](https://github.com/SOFTURE/AI/issues/885): an assistant checks a "done" against production in one
call. `createMcpServerFactory` gets an opt-in `serverInfoTool` that registers a read-only `get_server_info` tool. It
answers the same build info as the ops build info route (release, commit, build and start times, the optional
changelog) plus the server name and the version the server answered at `initialize`, which follows the tool list
(#877).

## Context

Labels: `enhancement`. Builds on #877 (`createMcpServerFactory`, the tool list version), #876 (strict input on the same
factory) and #878 (`readBuildInfo()` in `@softure-ai/ops/server`, still unreleased). No version bump: the coordinator
releases the batch.

## Constraints

- Opt-in, read only, no user data: only the public facts the build info route answers.
- `/server` must not import `@softure-ai/ops` (an optional peer): an app without ops still bundles it.

## Notes

- Framing: skipped. The issue names the gap, the tool and the data it answers.
