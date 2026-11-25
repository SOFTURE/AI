---
change_id: theme-notion-dialog-first-field
title: "theme-notion: a dialog or sheet opens with focus on its first field, not on a tooltip trigger (issue #1476)"
status: open
roadmap_item: null
issue: 1476
branch: claude/project-thread-0c0deo
created: 2026-11-25
updated: 2026-11-25
---

## Intent
A `Dialog` or `Sheet` whose first focusable element is a tooltip trigger (a "?" beside a field's label) opens with
no tooltip shown and focus on its first form field. Tab onto the "?" still shows the tooltip. Issue #1476
(`bug`, `pkg: theme-notion`).

## Context
Radix `DialogContent` auto-focuses the first tabbable element on open; Radix Tooltip opens on focus, so the help
button's tooltip covers the form as the dialog opens, mouse-opened included. An adopting app works around it with an
`onOpenAutoFocus` handler that focuses the first input, select or combobox.

## Scope
- `DialogContent` and `SheetContent` focus the first form control on open (`input` other than hidden, `select`,
  `textarea`, `[role=combobox]`, not disabled), and fall back to Radix's default when there is none or the app's own
  `onOpenAutoFocus` prevented it.
- Tests (red first), upstream deltas, README, CHANGELOG `Unreleased`.
- Out of scope: the adopting app; `AlertDialogContent` (Radix focuses its Cancel button, never a tooltip trigger).

## Decisions (auto)
- The dialog-side proposal, not the tooltip-side one: the acceptance asks for focus on the first field, which only
  the dialog side gives; a tooltip that ignores non-`focus-visible` focus would still open after a keyboard-opened
  dialog, where the browser marks programmatic focus as visible.
- `AlertDialog` left as it is: its content focuses Cancel, a safe default for a confirmation.
- The field is focused as Radix focuses (no scroll, text selected), so only the target changes.
- Patch-level change recorded under `Unreleased`; release per the brief.

## Notes
- research skipped: the cause (Radix focus-on-mount meets tooltip-on-focus) and the fix are named in the issue; the
  two content components and their tests are the only consumers in the repository.
- frame skipped: a reproduced bug with an agreed acceptance.
