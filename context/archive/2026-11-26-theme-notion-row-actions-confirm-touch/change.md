---
change_id: theme-notion-row-actions-confirm-touch
title: "theme-notion: RowActionsMenu's confirmation buttons are the touch target on a phone (issue #1502)"
status: archived
roadmap_item: null
issue: 1502
branch: claude/project-thread-1iw7ot
created: 2026-11-26
updated: 2026-11-26
archived_at: 2026-11-26
---

## Intent
On a phone, the Cancel and confirm buttons of `RowActionsMenu`'s confirmation dialog are the 44 px touch target, like
the menu's items and the row's own controls; a desktop keeps the compact 28 px buttons. Issue #1502 (`bug`,
`pkg: theme-notion`).

## Context
theme-notion 0.37.0 renders `AlertDialogCancel` / `AlertDialogAction` at the default `Button` size (`h-7`) on every
width, while the menu items got `max-md:min-h-touch-target` in #1492.

## Scope
- Both confirmation buttons get `max-md:h-touch-target` below `md`.
- A unit test (red first), CHANGELOG `Unreleased`, the "NOTION · Design System" artifact.
- Out of scope: `AlertDialog` defaults for other users; the adopting app.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: a reported bug with the expected result and the file named in the issue.

## Done
`RowActionsMenu`: the confirmation dialog's Cancel and confirm buttons are the 44 px touch target below `md`
(`max-md:h-touch-target`); a desktop keeps the compact 28 px buttons. Test (red first), README, CHANGELOG `Unreleased`,
the Design System artifact (v97-98); ships in theme-notion 0.37.1. An adopting app's row Delete on a phone confirms
with the same 44 px buttons as its own dialogs.
