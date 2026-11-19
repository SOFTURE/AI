---
change_id: auth-oidc-link-unverified
title: "auth: a first provider sign-in ends the access of an unverified password account it links"
status: archived
archived_at: 2026-11-19
roadmap_item: null
issue: null
branch: claude/project-thread-amoubq
created: 2026-11-19
updated: 2026-11-19
---

## Intent

An account registered with a password has an email nobody proved. When the owner's first OpenID Connect or GitHub
sign-in links it by that email, nothing the registrant holds (password, sessions, a reset link) may outlive the link.

## Context

Found by the 2026-11-19 security review of `modules/auth` (asked in chat, no issue). `resolveOidcAccount` linked the
account and left its password and sessions alive, so whoever registered the owner's address first kept a way in.

## Scope

- `modules/auth/src/server/oidc/accounts.ts`: on a link to an account with no identity yet, replace the password by
  an unusable one and delete its sessions and password resets, in the sign-in's transaction.
- Tests in `oidc-flow.test.ts` and `oidc-github.test.ts`; README (Accounts) and CHANGELOG (Unreleased).

## Constraints

- No migration, no API change. An account a provider already verified keeps its password and sessions.

## Notes

- Frame skipped: the finding names the cause and the fix; research is the review itself (`research.md`).

## Decisions (auto)

- "Verified" means the account already has a provider identity; email verification does not exist in auth today.
- The password is replaced by a random unusable hash (as for a provider-created account) instead of a nullable
  column: no migration, and the reset flow gives the owner a password back.

## Done

- Fix and tests on master; released with the next auth release.
