---
change_id: connections-github-app-installations
title: "connections: GitHub App calls for users' own installations (github-app)"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-2flrdk
created: 2026-11-17
updated: 2026-11-17
archived_at: 2026-11-17
---

## Intent

Let an app whose own users each connect a repository of theirs (a GitHub App installed on their account) mint
installation tokens and prove that an installation belongs to the signed-in user, without writing the JWT signing,
the token exchange and the ownership check again. Today `@softure-ai/connections` connects only the app's own accounts,
as its admin, through OAuth tokens or keys it stores.

## Context

Gap met by an adopting app that reads a user's notes repository through a GitHub App with read-only contents access.
Fixed here directly and kept generic (owner's standing order for adopting apps: a gap any app would hit is fixed in
SOFTURE/AI, released before the app depends on it).

## Scope

- New entry `@softure-ai/connections/github-app` (Node and Workers): the App's RS256 JWT from a PKCS#1 or PKCS#8 key,
  an installation's details, an installation token narrowed by repositories and permissions, the repositories a token
  reaches, the user code exchange, and the repositories of one installation a user's token reaches.
- `createFakeGithubApp` in `/testing`; README, CHANGELOG, a minor release (0.5.0).

## Constraints

- Stateless: no table, no migration, no change for apps that do not import the entry.
- No token, key or GitHub message in an error.

## Notes

- Webhooks (installation deleted) are left out: the app learns of a removed installation from
  `connections.github_app_not_found` on its next call, which works without a public webhook endpoint.
