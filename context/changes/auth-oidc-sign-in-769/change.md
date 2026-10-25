---
change_id: auth-oidc-sign-in-769
title: "auth: sign in with an OpenID Connect provider (Google), limited to allowed domains or emails (issue #769)"
status: implementing
roadmap_item: null
issue: 769
branch: claude/project-thread-yi0acu
created: 2026-10-25
updated: 2026-10-25
archived_at: null
---

## Intent

Close [issue #769](https://github.com/SOFTURE/AI/issues/769). A private app wants "Sign in with Google" (or any
OpenID Connect provider) as the only way in, for the accounts of one Workspace domain or a short list of emails: no
password, no registration form, no outer sign-in (Cloudflare Access) in front of the host.

## Context

Labels: `enhancement`, `pkg: auth`. auth 0.2.5 is on npm and on master. `@softure-ai/connections` has an OAuth client
for API access, but it depends on auth, so auth cannot reuse it (cycle); the OIDC client lives in auth, following the
same care (one-time state, PKCE, no provider text echoed). Releases are batched by the coordinator: no version bump
here, the CHANGELOG gets `## Unreleased`.

## Acceptance

- `auth({ oidc: { providers: [...] } })` (off by default) adds a provider button on `LoginPage`; with
  `password: { enabled: false }` only the buttons are shown and every password route refuses.
- Authorization code flow with PKCE S256, a one-time `state` bound to the browser and a `nonce`; callback
  `/api/auth/oidc/<provider>/callback` built from `appOrigin`.
- The ID token is validated (signature against the issuer's JWKS, `iss`, `aud`/`azp`, `exp`, `iat`, `nonce`),
  `email_verified` is required, then `allowedDomains` (email domain, and Google's `hd`) / `allowedEmails`. A refused
  identity lands on the login page with an error code and never creates an account.
- An identity maps to `auth.users` by a stored `(provider, subject)` pair (`auth.identities`); a first sign-in links
  an existing account with the same verified email, or creates one when `createAccounts` is on.
- The session is a normal auth session: `requireUser`, `requireRole`, `adminEmails` work unchanged.
- Copy through `messages`; rate limits for start and callback in `AUTH_RATE_LIMIT_BUCKETS`; the privacy contributor
  covers the new table.
- Tests with a fake OIDC provider (issuer, discovery, JWKS, token endpoint) shipped in `@softure-ai/auth/testing`.

## Constraints

Owns `modules/auth/**` and this change folder. Never touches an adopting app's repository; the migration for the app
is in the CHANGELOG and the issue's closing comment.

## Notes

- Framing: skipped. The issue states the problem, the proposal and the acceptance.
