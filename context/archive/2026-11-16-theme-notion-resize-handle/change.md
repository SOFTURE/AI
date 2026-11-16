---
change_id: theme-notion-resize-handle
title: "theme-notion: ResizeHandle and SidePanel width (issue #1311)"
status: archived
roadmap_item: null
issue: 1311
branch: claude/project-thread-epkxva
created: 2026-11-16
updated: 2026-11-16
---

## Intent

An app lets the user drag the border between two columns of a map screen (a list column, a `SidePanel layout="list"`)
to set a column's width, with the keyboard too, within limits, with a double click that restores the default, without
styling its own handle.

## Context

Issue #1311 (`enhancement`, `pkg: theme-notion`), raised by an adopting app. theme-notion has no resize primitive and
`SidePanel` has a fixed width.

## Constraints

- No new dependency; new optional prop only on `SidePanel`.
- Tests, gallery case, parity fixture and visual baselines in the same change.
- Released as theme-notion 0.20.0 (the adopting app waits for it).

## Notes

- Research kept short in research.md: one new component and one prop, no shadcn upstream file.

## Done

- theme-notion 0.20.0: `ResizeHandle`, `clampSize`, `RESIZE_HANDLE_STEP`, `SidePanel width` (#1311).
- Release: theme-notion 0.20.0 through auto-release after the merge.
