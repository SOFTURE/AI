---
change_id: theme-notion-list-entry-arrow-middle
title: "theme-notion: ListEntry's arrow shares the middle of the controls beside it (issue #1520)"
status: archived
roadmap_item: null
issue: 1520
branch: claude/project-thread-wypkxq
created: 2026-11-26
updated: 2026-11-26
archived_at: 2026-11-26
---

## Intent
In a linked `ListEntry` with a control beside the arrow (an icon button such as a delete trash can), the arrow and
the control read as one line: their vertical middles match, on a desktop (a 24 px icon button) and on a phone (a 44 px
touch target). Issue #1520 (`bug`, `pkg: theme-notion`).

## Context
#1497 (0.37.0) aligned `list-entry-side` to the top (`items-start`) and gave the arrow a 20 px box (`h-5`), so the
arrow sits on the title's line next to a status badge. With a control taller than 20 px and no status above it, the
arrow's middle stands 2 (desktop) to 12 px (phone) above the control's middle.

## Scope
- `list-entry-side` centres the arrow on the right column whenever the column is a single line of content; with a
  stacked status over controls (and with a `data-row-wide` control) it keeps the top alignment, so the arrow stays on
  the status's (the title's) line as #1497 requires.
- Unit and browser geometry tests (red first), a gallery row with a link and an icon action only, parity fixture,
  gallery baselines, README, CHANGELOG `Unreleased`, the "NOTION · Design System" artifact.
- Out of scope: the adopting app; a new prop.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: a reported bug with the expected layout and a proposed fix in the issue.

## Done
`ListEntry`: in a linked row whose right column is one line (controls with no status, a status alone, or
`sideLayout="inline"`), the arrow shares the column's vertical middle, so an icon button beside it stands level with
the arrow on a desktop and on a phone; a status stacked over controls keeps the arrow on the title's line (#1497).
Unit and browser geometry tests (red first), a gallery row, parity fixture, gallery baselines, README, CHANGELOG
`Unreleased`, the Design System artifact (v109-110); ships in the next theme-notion release.
