---
change_id: theme-notion-sortable-752
title: "theme-notion: sortable list, drag to reorder with a lifted row and a touch hold (issue #752)"
status: archived
roadmap_item: null
issue: 752
branch: claude/project-thread-zkpdgn
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #752](https://github.com/SOFTURE/AI/issues/752): export a sortable list part from
`@softure-ai/theme-notion` (`SortableList`, `SortableItem`, an optional `SortableHandle`) whose rows are reordered by
dragging. A long press (500 ms) lifts a row on a phone, a swipe before the hold still scrolls, a tap still activates
the row; the lifted row has a named look (`data-dragging`); announcements and instructions are localisable.

## Context

- Labels: `enhancement`, `pkg: theme-notion`, `adoption` (found adopting theme-notion 0.2.0).
- The adopting app builds this today from `@dnd-kit/core` and `@dnd-kit/sortable` and composes the lifted look
  (`bg-accent-strong shadow-menu`) and the touch classes itself.

## Constraints

- The behaviour comes from a headless library; the look only from the theme's tokens, as literal class names under
  `src/notion/` (a theme `@source`).
- Controlled: the app owns the order and gets the new one in a callback.
- Keyboard reordering and screen-reader announcements work out of the box, with every text replaceable by a prop.
- No version bump: the coordinator releases theme-notion.

## Notes

- Framing: skipped. The issue names the behaviour, the look and the library the app already uses.
