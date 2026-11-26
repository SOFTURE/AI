---
change_id: theme-notion-list-entry-top-align
title: "theme-notion: ListEntry keeps its state on the title's line with a multi-line identity (issue #1497)"
status: archived
roadmap_item: null
issue: 1497
branch: claude/project-thread-n42ozb
created: 2026-11-26
updated: 2026-11-26
archived_at: 2026-11-26
---

## Intent
An adopting app that moved its list screens onto `ListEntry` sees the row's state on the title's line again: with a
title plus detail lines, chips or a time, the status badge stands level with the title and the controls follow under
it, instead of floating in the middle of the row. Issue #1497 (`bug`, `pkg: theme-notion`, `adoption`).

## Context
`ListEntry` (#1481, 0.34.0) lays its root and its right column out with `items-center`, so the column is centred
against the identity. The component's own description says the state sits at the top of the right column.

## Scope
- The `list-entry` root and `list-entry-side` align to the top; the arrow of a linked row is centred on the title's
  first line.
- A unit test and a browser geometry test (red first), README, CHANGELOG `Unreleased`, the "NOTION · Design System"
  artifact.
- Out of scope: the adopting app; an `align` prop (not needed, see `plan.md`).

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: a reported bug with the expected layout and a proposed fix in the issue.

## Done
`ListEntry`: the identity and the right column align to the top, so with a multi-line identity the state stands on
the title's line and the controls under it; the arrow of a linked row is centred on the title's line. Unit and browser
geometry tests (red first), parity fixture, README, CHANGELOG `Unreleased`, the Design System artifact (v93-94); ships
in the next theme-notion release. An adopting app's layout checks (badge level with the title) pass without overrides.
