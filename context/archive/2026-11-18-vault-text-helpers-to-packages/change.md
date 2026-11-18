---
change_id: vault-text-helpers-to-packages
title: "core, mcp-access: accent folding for search and the untrusted-text wrapper for MCP answers"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: null
branch: claude/project-thread-83sm99
created: 2026-11-18
updated: 2026-11-18
---

## Intent

Move two small helpers an adopting app wrote into the packages they belong to, so the other apps stop writing them
again: accent folding for text search (the adopting apps carry more than a dozen local copies of the same
`normalize` + strip-marks + stroked-l line) and the wrapper that puts user-written text between data markers in MCP
answers (every app's MCP server returns text a user or a mail wrote).

## Scope

- core: `foldText`, `foldWords` (the adopting app's output kept byte for byte, since it feeds a stored search column).
- mcp-access `/server`: `createUntrustedWrapper({ open, close })` with `wrap` and `defuse`; markers stay the app's copy.
- Patch releases (additive): core 0.2.11, mcp-access 0.7.7.

## Out of scope

agent-ready's own folding stays: it must keep one character per character so match indexes map back to the input,
which `ß` → `ss` breaks.

## Notes

Research skipped: the code already runs in the adopting app with its tests; it moves with them. Frame skipped: a
move, not a new behaviour.
