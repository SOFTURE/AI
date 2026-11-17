---
change_id: auth-open-sign-up
title: "auth: open sign-up through a provider (openSignUp)"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-dyaxco
created: 2026-11-17
updated: 2026-11-17
archived_at: 2026-11-17
---

## Intent

Let a public product offer "Sign in with GitHub" (or any OpenID Connect provider) to anyone. Today every provider needs
`allowedDomains` or `allowedEmails`, which fits an internal tool but not a product where any visitor signs up.

## Context

Gap met by an adopting app whose sign-up offers email and password or GitHub to every visitor, with registration
closable by the `auth.registration_closed` switch. Fixed here directly, kept generic (owner's standing order for
adopting apps: a gap any app would hit is fixed in SOFTURE/AI, released before the app depends on it).

## Scope

- Provider option `openSignUp` (default false): any verified email may sign in; the allowlist may be empty.
- A first sign-in through an open provider creates an account only while registration is open; otherwise the new code
  `auth.oidc_registration_closed`. Existing accounts keep signing in. Allowlist providers unchanged.
- English copy for the code (optional key in `AuthMessages`), the fake GitHub provider option, README, CHANGELOG,
  a patch release.

## Constraints

- No migration, no behaviour change for apps that do not set the option.
- Unverified emails are never accepted.

## Notes

- Research kept short (one file read path): the allowlist lives in `server/oidc/allowlist.ts`, account creation in
  `server/oidc/accounts.ts`, the switch in `server/switches.ts`.
