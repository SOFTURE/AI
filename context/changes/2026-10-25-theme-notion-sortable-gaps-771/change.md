---
change_id: theme-notion-sortable-gaps-771
title: "theme-notion: SortableList gaps, disabled, drop groups, drag callbacks, activator, ol (issue #771)"
status: in_progress
roadmap_item: null
issue: 771
branch: claude/project-thread-8yxuzo
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #771](https://github.com/SOFTURE/AI/issues/771): an adopting app can replace its own
`DndContext`/`useSortable` wiring with `SortableList` from `@softure-ai/theme-notion` without changing behaviour.
The part gains a disabled list and disabled rows, drops limited to a row's group, drag lifecycle callbacks, an app
element as the pointer activator inside a row, and rendering as an `<ol>` that also holds non-sortable items.

## Context

- Labels: `enhancement`, `pkg: theme-notion` (follow-up to #752, found adopting theme-notion 0.3.0).
- The part shipped in 0.3.0 (`themes/theme-notion/src/notion/Sortable.tsx`).

## Constraints

- Additive only: every existing prop keeps its meaning and default; the literal classes stay as they are (the design
  system slot snapshot pins them).
- English only; the migration for the app is spelled out in the CHANGELOG and the issue.
- No version bump: the coordinator releases theme-notion.

## Notes

- Framing: skipped. The issue names each gap and the dnd-kit feature behind it.
