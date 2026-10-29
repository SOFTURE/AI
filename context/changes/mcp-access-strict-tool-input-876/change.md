---
change_id: mcp-access-strict-tool-input-876
title: "mcp-access: strict tool input (issue #876)"
status: in_progress
roadmap_item: null
issue: 876
branch: claude/project-thread-um4tf6
created: 2026-10-29
updated: 2026-10-29
---

## Intent

Close [issue #876](https://github.com/SOFTURE/AI/issues/876): zod objects strip unknown keys, so a tool call with a
misspelt or renamed field answers as a successful write while the value is dropped. Give
`@softure-ai/mcp-access/server` a `withStrictToolInput(server, options)` that rewrites every tool's input schema at
registration: unknown fields are refused at every level with a message naming the field and the accepted ones, a field
sent under an old name is refused with the stable code `input.field_renamed` naming the new one, and boolean and number
fields also take their exact text form. The server factory gets the same as an option.

## Context

Labels: `enhancement`, `pkg: mcp-access`. Builds on `createMcpServerFactory` from #877 (merged in 2d39061). No version
bump: the coordinator releases the batch.

## Constraints

- Backwards compatible: opt-in; servers that do not call it behave as before.
- The listed JSON Schema keeps `boolean`/`number` for coerced scalars; only `additionalProperties: false` is added.
- The SDK refuses before the handler runs, so nothing is saved on a refused call.

## Notes

- Framing: skipped. The issue names the gap, the behaviour and the adopting app's workaround.
