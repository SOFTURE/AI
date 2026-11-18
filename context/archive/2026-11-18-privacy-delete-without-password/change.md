---
change_id: privacy-delete-without-password
title: "privacy: an account a provider created deletes itself by signing in again"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: null
branch: claude/project-thread-13du28
created: 2026-11-18
updated: 2026-11-18
---

## Intent

An account that signs in only through a provider (OpenID Connect or GitHub) can delete itself: it confirms by signing
in with the provider again instead of typing a password nobody knows.

## Context

`resolveOidcAccount` creates an account with a random, unusable password. `deleteOwnAccount` re-checks the password
with `isCurrentPassword`, so such an account cannot delete itself; an adopting app worked around it by telling the
user to set a password through the reset link first. With `password.enabled: false` no account could delete itself.

## Scope

- auth: `findRecentProviderSignIn` (the provider whose sign-in opened this very session within N minutes) and
  `findLinkedProviders` in `/server`.
- privacy: `deleteOwnAccount` takes an optional `sessionToken`; an empty password with a fresh provider sign-in is
  accepted, otherwise `privacy.reauthentication_required`. Option `deletion.recentSignInMinutes` (default 10).
  `getDeletionReauthentication` (`/server`), `getDeleteAccountReauthentication` (`/next`), the form's
  `reauthentication` prop with one "Confirm with <provider>" button per linked provider; `PrivacyPage` uses it.
- New message keys are optional in `PrivacyMessages` with an English fallback.
- Releases: auth 0.2.18, privacy 0.2.4 (patch: additive).

## Notes

- Research and frame skipped: the cause is read from the code (the unusable password in `oidc/accounts.ts`, the
  password check in `self-service.ts`), and re-authentication by a fresh sign-in is the usual answer ("sudo mode").

## Decisions (auto)

- Only the session the provider sign-in opened counts (identity stamped, then the session opened within 60 s of it):
  a password login after a provider sign-in elsewhere does not confirm, and a stolen older session cookie does not
  either. Ten minutes by default, configurable 1-60.
- A typed password is always checked, even with a fresh sign-in: the form sends one method at a time.
- No new ui primitive: the form uses `Button`, `PasswordField`, `Checkbox` and the `text-success` token already in
  `@softure-ai/ui`, so themed apps (the Notion kit) pick it up through the existing bridge.
