---
change_id: mcp-access-token-manager-sections
title: "mcp-access: TokenManager shows only the named sections"
status: in_progress
roadmap_item: null
issue: null
branch: claude/project-thread-j5yrtp
created: 2026-11-09
updated: 2026-11-09
---

## Intent

An adopting app wants its token page in tabs (the token form, the tokens, the connected apps) with the tool catalog
folded in an accordion. `TokenManager` renders every part in one column, so the app cannot place them. Add an optional
`sections` prop that shows only the named parts; the app renders one `TokenManager` per tab or panel.

## Context

Found by an adopting app while laying out its assistant page. The owner's standing order: a gap in a package is fixed
in the package, released and bumped in the app, with no issue filed.

## Constraints

- Left out, the page renders exactly as before (no migration for apps).
- The page order stays fixed; a section without its data stays hidden as today.

## Notes

- Research: skipped. One component, read in full; the gap and the fix are fully in `token-manager.tsx`.
- Framing: skipped. The problem is a layout the app cannot express; nothing in doubt.
