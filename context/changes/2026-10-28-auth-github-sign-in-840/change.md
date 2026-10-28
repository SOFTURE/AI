---
change_id: auth-github-sign-in-840
title: "auth: sign in with GitHub (OAuth App), limited to allowed emails or domains (issue #840)"
status: implementing
roadmap_item: null
issue: 840
branch: claude/project-thread-5gulb1
created: 2026-10-28
updated: 2026-10-28
---

## Intent

Let an app sign people in with their GitHub account through `auth({ oidc })`, next to the OpenID Connect providers:
a provider entry `type: "github"` reuses the state, PKCE, cookie, rate limits, callback route, allowlist,
`auth.identities` and account linking of the OpenID Connect sign-in, and swaps only the protocol step (GitHub's fixed
authorize and token endpoints, then the account read from the REST API instead of an ID token). The fake provider in
`@softure-ai/auth/testing` covers GitHub, so an app tests its sign-in without network.

## Context

- Labels: enhancement, pkg: auth. [Issue #840](https://github.com/SOFTURE/AI/issues/840).
- Builds on the OpenID Connect sign-in (#769), display name (#802) and the opt-in rules (#786).

## Constraints

- Sign-in stays opt-in: without a provider nothing of it runs; no new table, bucket or route.
- No version bump: the coordinator releases. CHANGELOG under `Unreleased`; six packages depend on auth `^0.2.0`,
  so the next release is a patch.
- The access token is never stored or logged; nothing GitHub says is echoed to the user.

## Notes

- `frame` skipped: the issue states the problem and the proposal precisely.
