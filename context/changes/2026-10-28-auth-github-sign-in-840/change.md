---
change_id: auth-github-sign-in-840
title: "auth: sign in with GitHub (an OAuth App), limited to allowed emails or domains (issue #840)"
status: in_progress
roadmap_item: null
issue: 840
branch: claude/project-thread-0y1osg
created: 2026-10-28
updated: 2026-10-28
---

## Intent

[Issue #840](https://github.com/SOFTURE/AI/issues/840): `auth({ oidc })` signs people in only through OpenID Connect
providers, and GitHub is not one (no discovery, no ID token). An adopting app whose owner signs in with GitHub has to
write its own OAuth client. Add a `type: "github"` entry to `oidc.providers` that reuses the state, PKCE, cookie, rate
limits, callback route, allowlist, identities and sessions, and replaces only the protocol step (code for an access
token, then the account and its verified emails from the GitHub API).

## Constraints

- Additive: every existing provider entry (no `type`) parses and behaves as before.
- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- No new table, no migration: `auth.oidc_states` and `auth.identities` carry the GitHub sign-in as they are.
- The access token is never stored or logged.

## Notes

- `frame` skipped: the issue states the problem and the shape precisely.
