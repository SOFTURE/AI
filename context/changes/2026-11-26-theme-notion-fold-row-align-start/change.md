---
change_id: theme-notion-fold-row-align-start
title: "theme-notion: FoldRow aligns its bar to the summary's first line on request (issue #1495)"
status: open
roadmap_item: null
issue: 1495
branch: claude/project-thread-e6brv5
created: 2026-11-26
updated: 2026-11-26
---

## Intent
An adopting app draws a multi-line summary (a title, a stage line, two lines of outcome) in a `FoldRow` with a
`status` and `actions`, and wants the chevron, the title and the status on the same first line, the action under the
status, without local selector overrides. Issue #1495 (`bug`, `pkg: theme-notion`).

## Context
In theme-notion 0.36.0 the summary is `items-center`, so the chevron sits at the vertical middle of a multi-line
summary, and the right column (`fold-row-actions`) is `md:justify-center`, so a status sits on the summary's middle
line. On a one-line summary both look right.

## Scope
- A new `align` prop on `FoldRow`: `"center"` (default, today's layout) or `"start"`. With `"start"` the chevron sits
  on the summary's first line and the right column is top-aligned (status on line 1, the actions under it).
- Applies to both summary shapes (the fixed title and the app's own `summary` node).
- Unit tests (red first), README, CHANGELOG `Unreleased`, the "NOTION · Design System" artifact.
- Out of scope: the adopting app; `ListEntry` (issue #1497, its own change).

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: a reported gap with a proposed shape (`align="start"`) and expected layout in the issue.
