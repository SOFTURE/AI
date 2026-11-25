---
change_id: auth-invitation-revoke-confirm
title: "auth: InvitationPanel asks before it revokes an invitation (issue #1470)"
status: archived
roadmap_item: null
issue: 1470
branch: claude/project-thread-fo74vb
created: 2026-11-25
updated: 2026-11-25
archived_at: 2026-11-25
---

## Intent
"Revoke" on a pending invitation in `InvitationPanel` opens a confirmation dialog first, like every other destructive
control in an adopting app, so a stray click no longer kills an invitation link. Issue #1470 (`enhancement`,
`pkg: auth`).

## Context
`InvitationPanel` (`modules/auth/src/ui/invitation-panel.tsx`) renders Resend and Revoke as one form each, posting
to the server action through `useActionState`, so the panel works without JavaScript; a success redirects back with a
notice. `@softure-ai/ui` has `Modal`, `ModalBody` and `ModalFooter` (focus moves in, returns to the opener on close,
built-in en/pl copy for Cancel and Close) and `ConfirmActionButton`, which calls the action directly and expects a
`ConfirmActionResult`, not the panel's redirecting form action.

## Scope
- Revoke stays the row's submit button; with JavaScript a click opens a dialog instead of submitting: title naming the
  invited email, one line on the effect, Cancel and a destructive Revoke that submits the row's form. Without
  JavaScript the button submits as today.
- `InvitationPanelRow.email` (optional) names the invitation in the title; `toInvitationRow` fills it.
- New copy keys in `invitations` (`revokeTitle`, `revokeTitleUnnamed`, `revokeBody`, `revokeConfirm`), optional in
  `AuthMessages` so an app's existing dictionary still compiles; a missing key reads English.
- Row actions are 44 px tall below the `sm` breakpoint.
- `modalClassNames` prop: the dialog's slots, so an app's dialog look (its motion, its close button) applies.
- Tests, README, CHANGELOG `Unreleased`.
- Out of scope: an app-supplied confirm component (the issue marks it optional; `modalClassNames` covers the look).

## Decisions (auto)
- Own dialog on `Modal` instead of `ConfirmActionButton`: the latter calls the action directly and needs JavaScript,
  which would drop the panel's no-JavaScript form and its `useActionState` error and pending state. The confirm button
  calls `requestSubmit()` on the row's form, so the existing action path is unchanged.
- The copy stays English-only in the package, like every other auth key: `authMessages` ships only `en`, an app
  passes its Polish dictionary. Cancel and Close come from `@softure-ai/ui`'s built-in en/pl copy.
- Patch-level change under `Unreleased`; the coordinator cuts the release.

## Notes
- research skipped: one component, its tests and the page that builds its rows are the only consumers; the issue names
  the fix.
- frame skipped: a reported missing confirmation with one proposed shape.

## Done
`InvitationPanel` asks before it revokes: Revoke opens a dialog titled "Revoke the invitation for {email}?" with one
line on the effect, Cancel (keeps the invitation, focus back on Revoke) and a destructive Revoke that submits the row's
form; without JavaScript Revoke posts at once. New `InvitationPanelRow.email` (filled by the page), `modalClassNames`,
four optional copy keys, 44 px row actions below `md`. Tests (red first), README, CHANGELOG `Unreleased`; ships in the
next auth release.
