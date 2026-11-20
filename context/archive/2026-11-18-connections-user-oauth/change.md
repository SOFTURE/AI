---
change_id: connections-user-oauth
title: "connections: OAuth grants that belong to the app's own users (user-oauth)"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-x94t0i
created: 2026-11-18
updated: 2026-11-18
archived_at: 2026-11-18
---

## Intent

Let an app whose own users each connect their own account at an OAuth 2.0 provider (a cloud drive, a code host) run
that flow per user, without writing the state, PKCE, code exchange, refresh, revocation and sealing again. Today the
module's OAuth flow connects only the app's own accounts, as its admin (`panelRole`, one row per provider account).

## Context

Gap met by an adopting app that reads each user's notes from the user's own cloud drive: it wrote the whole OAuth
client itself, and its GitHub App link repeated the state and PKCE helpers. Fixed here directly and kept generic
(owner's standing order for adopting apps).

## Scope

- New entry `@softure-ai/connections/user-oauth` (Node and Workers): provider definitions, the one-time state and PKCE
  verifier, the authorize URL, the code exchange, refresh (rotation aware), revocation (RFC 7009 or a bearer POST),
  and sealing a grant to its user.
- The token client keeps a token answer's non-secret identifiers (`fields`).
- `createFakeOAuthProvider` serves the user flow; README, CHANGELOG, a minor release (0.7.0).

## Constraints

- Stateless: no table, no migration, nothing changes for an app that does not import the entry.
- No token, secret or provider description in an error or a log.

## Notes

- Frame skipped: the gap and its shape follow the `/github-app` precedent (stateless, the app keeps per-user rows).
- No UI: the connect screen belongs to the app (what a grant is for is the app's data); the app builds it from the
  existing Notion kit components, so no new kit component comes with this change.
