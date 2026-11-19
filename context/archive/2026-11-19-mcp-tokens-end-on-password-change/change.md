---
change_id: mcp-tokens-end-on-password-change
title: "mcp-access: a password reset or change ends the account's earlier tokens, grants and codes"
status: archived
archived_at: 2026-11-19
roadmap_item: null
issue: null
branch: claude/project-thread-amoubq
created: 2026-11-19
updated: 2026-11-19
---

## Intent

Taking an account back with a password reset must also end the MCP and API tokens and the OAuth grants whoever held
the account issued, not only its sessions.

## Context

Found by the 2026-11-19 security review of `modules/auth` and `modules/mcp-access` (asked in chat, no issue). Auth's
reset and change delete sessions; mcp-access tokens (90 days) and grants (rotated refresh tokens) stayed valid.

## Scope

- `modules/mcp-access/src/server/tokens.ts`: `findValidToken`, `listAccessTokens` and `pruneAccessTokens` compare
  `createdAt` with `auth.users.password_changed_at`.
- `modules/mcp-access/src/server/oauth.ts`: the code exchange and the refresh refuse a code or grant from before the
  change (the refresh deletes the grant); `listOAuthGrants` and `pruneOAuthRecords` follow.
- `tests/password-change.test.ts`, README overview, CHANGELOG (Unreleased).

## Constraints

- No migration and no change of auth: `password_changed_at` already moves on reset, change, the temporary password
  script and (auth 0.2.19) a provider link of an unverified account.

## Notes

- Frame skipped: the finding names the cause; research is the review itself (`research.md`).

## Decisions (auto)

- A passive check on `password_changed_at` instead of an auth hook that deletes rows: one package, covers every path
  that sets the column, no ordering between modules. Prune deletes the dead rows.
- A user's own password change ends their tokens too (not only a reset): it is also the step of someone who suspects
  a takeover. "Sign out everywhere" (`revokeUserSessions`) keeps tokens; they have their own revoke buttons.
- A token issued in the same instant as the change stays valid (`<=`).

## Done

- Fix and tests on master; released with the next mcp-access release.
