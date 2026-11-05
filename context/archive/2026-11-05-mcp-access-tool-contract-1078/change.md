---
change_id: mcp-access-tool-contract-1078
title: "mcp-access: get_server_info answers the served tool contract (issue #1078)"
status: archived
archived_at: 2026-11-05
roadmap_item: null
issue: [1078]
branch: claude/project-thread-hg9hdi
created: 2026-11-05
updated: 2026-11-05
---

## Intent

Close [issue #1078](https://github.com/SOFTURE/AI/issues/1078). Hosted clients keep a stale `tools/list` that nothing
server-side refreshes, but a tool result is never cached. `get_server_info` gets an opt-in `tools` option: it answers
each served tool's `name`, `description` and `inputSchema` for the caller's access level (the same measured listing the
version is computed from), an optional `name` input narrows it to one tool (an unknown name answers the names), and
the answer carries a hint that the server's contract is current.

## Context

Owns `modules/mcp-access` (server-info.ts, server-factory.ts, tool-list.ts, messages/en.ts, README, CHANGELOG). No
other open pull request touches the package.

## Constraints

- Backwards compatible: off by default; with it off the tool's schema and the version stay unchanged.
- No token, identity or user data in the answer.
- No version bump: CHANGELOG `## Unreleased`; the coordinator releases the batch.

## Notes

- Framing: skipped. The issue names the gap and the wanted API.
- Research: short (below), the code paths are two files.
