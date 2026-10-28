---
change_id: auth-github-sign-in-840
status: implementing
---

# Plan: sign in with GitHub (issue #840)

Input: change.md, research.md. Complexity: medium (one module, options + flow + fake + tests + docs).

## Phase 1: the GitHub provider

Files: `modules/auth/src/options.ts`, `src/server/oidc/{flow,github,discovery,context,index}.ts`, `src/index.ts`,
`src/server/index.ts`, `src/testing/{github-provider,index}.ts`, `tests/oidc-github.test.ts`, `tests/module.test.ts`.

1. Options: `oidc.providers` entries are a discriminated union on `type`: `"oidc"` (default, today's fields) or
   `"github"` (`id`, `name`, `clientIdEnv`, required `clientSecretEnv`, `authorizeParams`, `allowedDomains`,
   `allowedEmails`, `createAccounts`; no `issuer`, `scopes`, `clientAuth`, `requireHostedDomain`). The allowlist
   refinement applies to both. Types `OpenIdConnectProvider`, `GithubProvider`; `OidcProvider` is their union.
2. `server/oidc/github.ts`: fixed endpoints, scope `read:user user:email`; `exchangeGithubCode` (form POST,
   `Accept: application/json`, a 200 with `error` is a failure), `readGithubAccount` (`/user`, `/user/emails` with the
   bearer token; verified emails only, primary first), `pickGithubEmail` (first verified email the allowlist
   accepts). The access token stays in a local variable.
3. `flow.ts`: `startOidcSignIn` builds the GitHub authorize URL without discovery or nonce; `completeOidcSignIn`
   switches the protocol step after the shared state checks, then the shared account and session steps. Log line
   names the provider without saying "OpenID Connect".
4. Fake: `createFakeGithubProvider({ clock?, … })` in `@softure-ai/auth/testing`: authorize check (client id,
   PKCE S256, scopes), token endpoint (client secret, redirect URI, verifier, one-time code, form body without the
   JSON Accept header, OAuth errors with 200), `/user` and `/user/emails` checking the bearer token, `failNext`.
5. Tests: whole flow (create, link by email, subject = numeric id, display name from `name` else `login`), the
   allowlist over verified emails (primary first, a listed secondary, unverified ignored, domain), denial, errors with
   status 200, outage of the API, token never stored, options errors.

## Phase 2: docs

`modules/auth/README.md` (section 3: GitHub provider, registering the OAuth App, tests), `CHANGELOG.md` `Unreleased`.

## Decisions (auto)

- Keep the option under `oidc.providers` (the issue's shape) though GitHub is not OpenID Connect: one route, one
  cookie, one set of buckets and copy.
- `clientSecretEnv` is required for GitHub: an OAuth App's token endpoint always needs the secret.
- No extra `scopes` for GitHub: the token is discarded after the read, so more scopes only widen consent.
- Emails: the first verified one the allowlist accepts, primary first (the issue's rule); none → `oidc_not_allowed`.

## Progress

- [ ] Phase 1: the GitHub provider
- [ ] Phase 2: docs
