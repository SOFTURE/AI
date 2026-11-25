---
change_id: mcp-access-revoke-confirmation
title: "mcp-access: TokenManager confirms a revoke in a dialog (issue #1469)"
status: open
roadmap_item: null
issue: 1469
branch: claude/project-thread-9q3sxv
created: 2026-11-25
updated: 2026-11-25
---

## Intent
"Revoke" on the token page asks first: a confirmation dialog names the token, says the assistant using it loses
access at once, and offers Cancel and a destructive "Revoke". One misclick no longer disconnects an assistant.
Issue #1469 (`enhancement`, `pkg: mcp-access`).

## Context
`TokenManager` (`modules/mcp-access/src/ui/token-manager.tsx`) renders each token's Revoke as a plain form submit
to `revokeAction`; the OAuth "Disconnect" of a connected app works the same way. `@softure-ai/ui` already ships
`ConfirmActionButton` (a destructive action behind a `confirmation` dialog, `formAction` with hidden `fields`,
focus back on the trigger after Cancel, the error shown in the dialog), which the adopting app's design theme styles.
The parallel change for auth's invitation revoke (#1470) follows the same pattern.

## Scope
- Token Revoke and OAuth Disconnect open a confirmation dialog built on `Modal`, `ModalBody` and `ModalFooter` of
  `@softure-ai/ui`; the server action runs with the row's id on confirm, an error shows the module's copy in the dialog.
- Optional `confirmButton` prop: the app's own confirmation control gets `TokenManagerConfirmProps`.
- New copy in `messages/en.ts`: dialog titles naming the token or app, one-line effects, confirm labels.
- Tests: Revoke opens the dialog, Cancel keeps the token (no action call, focus back on the trigger), confirm
  revokes by id; the same for Disconnect; errors shown in the dialog. The example app's e2e confirm in the dialog.
- README, CHANGELOG `Unreleased` (no version bump: releases are batched).

## Decisions (auto)
- Compose the dialog from `Modal`/`ModalBody`/`ModalFooter` rather than `ConfirmActionButton`: the latter's trigger
  takes no accessible name of its own, and each row's button must stay named "Revoke: <token>" (screen readers, e2e).
  The primitives keep the theme's 44 px controls and return focus to the trigger on Cancel.
- Disconnect of an OAuth app gets the same dialog: it is the same kind of irreversible loss of access.
- The title names the token by its name; the row carries no token characters (only the hash is stored).
- The issue's optional ask is taken: `confirmButton` receives the copy and an `onConfirm()` that never rejects, so an
  app can plug `ConfirmActionButton` or its own component (README example).

## Notes
- research skipped: the gap and the primitive that closes it are both in the repository (token-manager.tsx,
  foundation/ui confirm-action-button.tsx); no external question.
- frame skipped: a reported UX gap with one proposed shape.
