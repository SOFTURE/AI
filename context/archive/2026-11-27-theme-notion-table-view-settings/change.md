---
change_id: theme-notion-table-view-settings
title: "theme-notion: a table's view settings to hide and show columns (issue #1529)"
status: archived
roadmap_item: null
issue: 1529
branch: claude/project-thread-oje0bu
created: 2026-11-27
updated: 2026-11-27
archived_at: 2026-11-27
---

## Intent
theme-notion ships `TableViewSettings`: a ghost icon button for a table's toolbar that opens a Notion-style
"Properties" popover, one row per column with its name and a switch, the shown columns first, "Hide all" and "Show
all", columns that cannot be hidden disabled, an optional drag reorder of the shown columns; plus
`applyColumnVisibility` (a pure helper that picks and orders the column definitions) and `useTableColumns` (a hook
that keeps the visibility and order in a caller-supplied store). Issue #1529 (`enhancement`, `pkg: theme-notion`).

## Context
theme-notion 0.41.1 has `Table`, `DropdownMenu` and `SortableList`, but no ready column visibility menu, so every
adopting app with a wide table composes its own trigger, list, toggles and bulk actions differently.

## Scope
- New composition `src/notion/TableViewSettings.tsx` (component, helper, hook), exported from the package root, its
  English copy in `messages/en.ts` (`tableViewSettings.*`) with a `messages` prop and a `label` prop.
- Unit tests, the gallery cases (closed in the toolbar of a table, and open on its own page), the class fixture, the
  visual baselines, README, CHANGELOG `Unreleased`, the "NOTION · Design System" artifact.
- Out of scope: `Table` itself and the sortable column header (#1528, another change); a built-in storage backend
  (the app supplies the store).

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: the issue names the gap, the API and the parts to reuse.

## Done
`TableViewSettings`: a table's Notion-style "Properties" menu, a ghost sliders button opening a popover with a switch
per column, the shown columns first under "Hide all", the hidden ones under "Show all", `canHide: false` kept on and
disabled, an optional drag (and keyboard) reorder of the shown columns with hidden ones kept in their slots; plus
`applyColumnVisibility` and `useTableColumns` (a caller-supplied store loaded after mount). Tests, gallery cases,
fixture, visual baselines, README, CHANGELOG `Unreleased`, the Design System artifact (v113-114). An adopting app
drops its own column menu.
