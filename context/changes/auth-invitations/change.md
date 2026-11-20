---
change_id: auth-invitations
title: "auth: invite a person by email while registration is closed (issue #1406)"
status: in_progress
roadmap_item: null
issue: 1406
branch: claude/project-thread-6j6zxo
created: 2026-11-20
updated: 2026-11-20
---

## Intent

Let an admin add a teammate from the app while `auth.registration_closed` stays on: an invitation by email, accepted
through a single-use, expiring link that opens a register form limited to that email.

## Context

Issue #1406 (labels `enhancement`, `pkg: auth`). Today the only ways to add a second person are the ops scripts
(`create-account`, `grant-role`), which need database access, or opening registration for everyone.

## Scope

- Table `auth.invitations` (migration 0007): email, invited roles, sha256 of the token, inviter, created, expires,
  accepted (with the account), revoked.
- Server: create (or refresh) an invitation, resend, revoke, list, find by token, register through an invitation (works
  while registration is closed; the invited roles are granted and `onRegistered` runs in the same transaction).
- Delivery through an app sender, with `mailingInvitationSender()` over `@softure-ai/mailing`.
- Next: the register page with `?invitation=` (form limited to the invited email, a neutral page for a dead link), an
  admin-only `InvitationsPage` (invite, list pending and accepted, resend, revoke), server actions.
- A new rate limit bucket `invitation` (per inviting admin) on the security module; acceptance counts in `register`.
- An audit line in the server log for every invite, resend, revoke and acceptance (ids only, never the email or link).
- Docs: README (how invitations combine with the OpenID Connect allowlists), CHANGELOG, privacy export and delete.

## Constraints

- Off unless the app passes `invitations.send`; no behaviour change for an app that does not.
- A dead link (unknown, expired, revoked, used) creates no account and reveals nothing about the email.
- Only the sha256 of a token is stored.
