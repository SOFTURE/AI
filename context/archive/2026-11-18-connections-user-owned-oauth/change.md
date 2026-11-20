---
change_id: connections-user-owned-oauth
title: "connections: OAuth connections owned by each signed-in user"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: null
branch: claude/project-thread-q1zp5x
created: 2026-11-18
updated: 2026-11-18
---

## Intent

A provider can belong to the app's users, not to the app: each signed-in user connects their own account at it (a
Dropbox folder, say) from a page of the app, and the app's code asks for that user's token. Today the module keeps one
connection per provider account for the whole app, so an adopting app with per-user OAuth keeps its own state table,
PKCE, code exchange and sealing next to the module.

## Context

- `connections.accounts` is unique on `(provider, account_id)`; every call names a provider account only.
- The callback route and the actions require the panel role.
- An adopting app runs its own OAuth flow for a per-user provider (state table, PKCE verifier, exchange, refresh,
  sealed refresh token per user), which this change makes unnecessary.

## Scope

- Provider option `owner: "app" | "user"` (default `app`), `returnPath` (required for `user`), `subjectField`.
- Module options `keysEnv` (the keyring's variable) and `accountReturnPath`.
- Migration 0003: `accounts.owner_id`, `accounts.subject`, the unique key split into two partial ones,
  `oauth_states.owner_id`.
- `ownerId` on every server and Next call that names a connection; `connections.wrong_owner`.
- Callback route for any signed-in user (`ownOnly`), `startOwnConnectionAction`, `disconnectOwnAction`,
  `listOwnConnections`; events carry `ownerId`.
- Privacy: export and delete a user's own connections.
- Tests, README, CHANGELOG, minor release.

## Constraints

- Additive for apps without user providers: every existing call keeps its meaning (an omitted owner is the app).
- Workers-safe, no new dependency.

## Notes

- Research skipped: the module is small and was read in full; the adopting app's local flow is the specification.
- Frame skipped: the owner asked for this exact gap to be closed in the package.

## Decisions (auto)

- Same table with an `owner_id` column, not a new table: refresh, leases, hooks, listing and the panel code stay one
  code path; two partial unique indexes keep each kind unique.
- The sealing context of an owned row includes the owner, so a row copied to another user does not open.
- A user's own connections are deleted with the account without calling the provider's revoke endpoint (deletion must
  not wait on a third party); an app that must revoke does it in its own deletion step.
- One callback route for both kinds: an admin completes any authorization, any other signed-in user only owned ones,
  so one redirect URI stays registered per provider.
