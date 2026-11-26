---
change_id: theme-notion-row-actions-async
title: "theme-notion: RowActionsMenu runs an async destructive action, opens an app dialog and meets the touch target (issue #1492)"
status: open
roadmap_item: null
issue: 1492
branch: claude/project-thread-fax32f
created: 2026-11-26
updated: 2026-11-26
---

## Intent
An adopting app replaces its own row overflow menu with the theme's `RowActionsMenu` without a local workaround: a
confirmed delete that calls a server action keeps its dialog open and pending until the promise settles, an action
that opens the app's own dialog leaves focus to that dialog and can hand it back to the menu button, and on a phone
the items are the 44 px touch target with a stable hook for browser tests. Issue #1492 (`enhancement`,
`pkg: theme-notion`, `adoption`).

## Context
`RowActionsMenu` shipped in theme-notion 0.35.0 (#1486). Its confirm button closes the alert dialog on press, the
menu returns focus to its internal trigger on close, and its content renders at the default 28 px item height.

## Scope
- `RowMenuDestructiveAction.onSelect` may return a promise; while it is pending the confirmation stays open, both
  buttons are disabled and the confirm button shows `confirm.pendingLabel`; it closes on resolve and stays open on
  rejection.
- `RowMenuAction.opensDialog`: the menu does not take focus back on close. `triggerRef` reaches the menu button.
- Items at least 44 px below `md`; `RowMenuAction.id` rendered as `data-row-action`.
- Unit tests per point (red first), README, CHANGELOG `Unreleased`, the "NOTION · Design System" artifact.
- Out of scope: the adopting app; `DropdownMenu` itself.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: a reported gap with a proposed shape and acceptance criteria in the issue.
