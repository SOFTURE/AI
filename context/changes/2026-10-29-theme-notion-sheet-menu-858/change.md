---
change_id: theme-notion-sheet-menu-858
title: "theme-notion: menu rows for a side Sheet, a phone's navigation drawer (issue #858)"
status: open
roadmap_item: null
issue: 858
branch: claude/project-thread-3lx8h0
created: 2026-10-29
updated: 2026-10-29
---

## Intent

Close [issue #858](https://github.com/SOFTURE/AI/issues/858): an adopting app shows its phone navigation in a `Sheet`
sliding in from the right (a heading with a close button, navigation rows at the top, one row at the foot). The theme
has no row for it: `SidebarMenuButton` needs a `SidebarProvider`, `DropdownMenuItem` needs a `DropdownMenu`, and a
ghost `Button` is a toolbar control. Add sheet menu rows (full width, left-aligned icon and label in the foreground
colour, a touch-target height on a phone and the row height from `md`, hover and focus like the sidebar's rows,
`disabled` dimmed) and a documented recipe for the heading with a ghost close button and a foot section.

## Context

Labels: `enhancement`, `pkg: theme-notion`. #859 (theme-notion) and #860 (theme-kit) run in parallel threads. No
version bump: the coordinator releases the batch.

## Constraints

- shadcn files under `src/ui/` stay the pinned upstream plus listed deltas; new parts go to `src/notion/`.
- Design tokens only; the design system artifact (NOTION · Design System) gets the same component.

## Notes

- Framing: skipped. The issue names the gap, the app's workaround and the proposal.
