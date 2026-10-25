---
change_id: theme-notion-fold-row-721
title: "theme-notion: DetailTable and FoldRow (issue #721)"
status: open
roadmap_item: null
issue: 721
branch: claude/project-thread-5ygzcn
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #721](https://github.com/SOFTURE/AI/issues/721): an adopting app drops its own list parts. Two
compositions join `@softure-ai/theme-notion`: `DetailTable` (an item's details as a label/value table) and `FoldRow`
(one folding list row that opens to a `DetailTable` plus optional children), with the look of the reference
implementation in the issue.

## Context

- Labels: enhancement, `pkg: theme-notion`, adoption.
- Depends on #720 (`Tone`, `TONE_COLORS`), carried by its own thread in parallel.
- The adopting app's tests read the `data-slot` names, so they are part of the contract.

## Constraints

- No built-in copy: every visible or accessible text comes by props.
- Server-rendered: a native `<details>`, no client state.
- English only; generic code through the theme package, nothing app-specific.

## Notes

- Framing: skipped. The issue names the outcome, the API and a reference implementation.
