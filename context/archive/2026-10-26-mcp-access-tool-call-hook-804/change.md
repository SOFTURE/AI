---
change_id: mcp-access-tool-call-hook-804
title: "mcp-access: an optional onToolCall hook around each tool call (issue #804)"
status: archived
roadmap_item: null
issue: 804
branch: claude/project-thread-ldi70r
created: 2026-10-26
updated: 2026-10-26
archived_at: 2026-10-26
---

## Intent

Close [issue #804](https://github.com/SOFTURE/AI/issues/804): an app that keeps a record of its MCP tool calls (which
tool, which client, whether it worked, how long it took) has no hook for it and wraps every tool's work itself. After
the change, `withToolErrors` and `actionTool` take an optional `onToolCall` hook that receives one record per call:
tool name, token id, client name, argument names (never values), the outcome with its error code, start time and
duration. A failing hook never changes the answer. A helper resolves a token's client name by its id.

## Context

- Labels: enhancement, `pkg: mcp-access` (found adopting `@softure-ai/mcp-access` in an adopting app).
- The adopting app wraps each tool's work inside `withToolErrors` to read the raw `Result` and time it, and looks up
  `mcp.access_tokens.name` by `tokenId` itself.

## Constraints

- Additive and optional: a tool without the hook answers exactly as before.
- Argument values never reach the hook.
- No release in this change: the coordinator releases in a batch.

## Notes

- Framing: skipped. The issue names the gap and a concrete proposal.
