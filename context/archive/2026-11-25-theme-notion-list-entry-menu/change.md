---
change_id: theme-notion-list-entry-menu
title: "theme-notion: a row overflow menu for ListEntry and the rules for row controls and row state (issue #1486)"
status: archived
roadmap_item: null
issue: 1486
branch: claude/project-thread-hx8or8
created: 2026-11-25
updated: 2026-11-25
archived_at: 2026-11-25
---

## Intent
A list row with several controls reads the same in every adopting app: at most one control inline (a switch or the
one primary action), every other action behind a "More actions" button on the same line, the destructive one last and
confirmed. Each fact is said once. An adopting app drops its local row overflow menu. Issue #1486 (`enhancement`,
`pkg: theme-notion`).

## Context
`ListEntry` (0.34.0, #1481) has one `actions` slot under the status. With four loose
controls the slot wraps to a second line and the row scatters. Follows #1481 and #1349 (DocumentRow actions crowding
out facts).

## Scope
- `RowActionsMenu`: an icon-only "More actions" button (accessible name from the message layer, overridable) that
  opens a `DropdownMenu` of items; an optional destructive item is last, after a separator, in the danger tone, and
  can open an `AlertDialog` confirmation before it runs.
- `ListEntry` `menu` slot: the menu button on the actions line, after the inline control, never wrapping away from it;
  at least the 44 px touch target on a phone.
- The rules for row controls and row state in the `ListEntry` docs (JSDoc and README).
- Tests (unit, keyboard behaviour, a Chromium measurement at 1280 and 390 px), a gallery case, the parity fixture,
  baselines, README, CHANGELOG `Unreleased`, the "NOTION · Design System" artifact.
- Out of scope: the adopting app; `ListRow` and `FoldRow` stay as they are.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: a reported gap with a proposed shape and acceptance criteria in the issue.

## Done
`RowActionsMenu`: an icon-only "More actions" button (name from the message layer, overridable) opening a menu of the
row's secondary actions, the destructive one last after a separator in the danger tone, optionally confirmed in an
alert dialog that runs it only on confirm and returns focus to the button; keyboard access measured in Chromium.
`ListEntry` `menu` slot: the inline control and the menu button on one line under the state at 1280 and 390 px, 44 px
on a phone; the phone rule no longer stretches a switch. The rules for row controls and row state in the JSDoc and
README. Tests (red first), a Chromium measurement, a gallery case, parity fixture, four gallery baselines, CHANGELOG
`Unreleased`, the Design System artifact (v85-86); ships in the next theme-notion release. An adopting app drops its
local row overflow menu.
