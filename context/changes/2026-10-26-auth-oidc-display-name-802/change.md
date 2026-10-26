---
change_id: auth-oidc-display-name-802
title: "auth: keep the display name an OpenID Connect provider returns (issue #802)"
status: in_progress
roadmap_item: null
issue: 802
branch: claude/project-thread-ocjzvc
created: 2026-10-26
updated: 2026-10-26
---

## Intent

Close [issue #802](https://github.com/SOFTURE/AI/issues/802): an app that signs users in through an OpenID Connect
provider can show who is signed in by name. auth stores the ID token's `name` (or `given_name`) on the account at every
OpenID Connect sign-in and exposes it as `displayName: string | null` on `AuthUser`; the privacy export lists it and the
deletion removes it with the account.

## Context

- Labels: enhancement, pkg: auth. Found while adopting auth 0.2.6 (Google sign-in) in an adopting app whose sidebar
  footer shows the signed-in user's name.
- Issue #786 (PR #796) also changes auth (messages); this change merges after it, with master merged in.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- Additive for apps: an app that builds an `AuthUser` literal (tests, fakes) keeps compiling.
- Migrations move forward only and say how to roll back.

## Notes

- Framing: skipped. The issue names the outcome and the proposal.
