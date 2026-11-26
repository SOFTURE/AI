---
change_id: theme-notion-side-layout-inline
title: "theme-notion: ListEntry and FoldRow put the state and the controls on one line (issue #1508)"
status: planned
roadmap_item: null
issue: 1508
branch: claude/project-thread-3kbpny
created: 2026-11-26
updated: 2026-11-26
---

## Intent
An adopting app shows a row's state and its controls on one line, the state left of the controls, instead of a badge
floating above a single icon control, without overriding the theme's `data-slot` classes. Issue #1508
(`enhancement`, `pkg: theme-notion`).

## Context
`ListEntry` lays its right column (`list-entry-column`) out as a column, the status over the actions line; `FoldRow`
does the same from `md` up (`fold-row-actions`). A row with one short badge and one icon control becomes two lines on
the right. theme-notion 0.38.0 has no option for one line.

## Scope
- A `sideLayout: "stack" | "inline"` prop on `ListEntry` and `FoldRow`, `stack` by default (today's layout).
- `inline`: the status first, then the actions line, on one row, wrapping right-aligned; a `data-row-wide` control
  keeps the full-width column; on a phone the `ListEntry` column still wraps under the identity, right-aligned, and the
  44 px touch targets stay.
- Unit tests and browser geometry tests (red first), gallery cases and baselines, README, CHANGELOG `Unreleased`, the
  "NOTION · Design System" artifact.
- Out of scope: changing the default layout; the adopting app.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: an enhancement with the expected layout and a proposed fix in the issue.
