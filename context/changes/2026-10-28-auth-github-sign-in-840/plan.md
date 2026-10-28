---
change_id: auth-github-sign-in-840
status: in_progress
---

# Plan: sign in with GitHub (issue #840)

Input: change.md, research.md. Complexity: medium (one new protocol step, a fake, docs).

## Phase 1: provider entry, flow and fake

Files: `modules/auth/src/options.ts`, `src/server/oidc/{flow,github,discovery,index}.ts`, `src/server/index.ts`,
`src/index.ts`, `src/testing/{github-provider,index}.ts`, `tests/github-flow.test.ts`, `tests/module.test.ts` if it
pins option parsing.

1. Options: `oidcProviderSchema` becomes a discriminated union on `type`: `"oidc"` (default, today's fields) and
   `"github"` (`id` default `github`, `name` default `GitHub`, `clientIdEnv`, required `clientSecretEnv`, `scopes`,
   `authorizeParams`, `allowedDomains`, `allowedEmails`, `createAccounts`; no issuer, no hosted domain). The allowlist
   refine stays on the union. Exported types `OidcProvider`, `OidcProviderInput`, plus `GithubProvider` narrowings.
2. `github.ts`: fixed endpoints; `getGithubAuthorizeUrl`; `exchangeGithubCode` (form POST, reads `access_token` or a
   200 `error` body); `readGithubAccount` (`/user`, `/user/emails`, only verified emails, primary first);
   `pickAllowedGithubEmail` over the shared allowlist check.
3. `flow.ts`: branch on `provider.type` at the authorize URL and after the client is read; the rest unchanged.
   `getAllowedEmail` reuses one `isAllowedEmail` helper.
4. `createFakeGithubProvider` in `@softure-ai/auth/testing`: authorize check (client, redirect, S256, scopes),
   one-time codes with PKCE, the token endpoint (including 200 errors), `/user`, `/user/emails`, `failNext`.
5. Tests: the full flow, account link and creation, the allowlist over several verified emails, an unverified
   primary, a 200 error at the token endpoint, an API outage, cancel, the access token never in a log line, option
   parsing (defaults, missing secret, an entry without `type` stays OpenID Connect).

## Phase 2: docs

`modules/auth/README.md` (GitHub subsection: the entry, the OAuth App's callback URL, scopes, what is read),
`CHANGELOG.md` `Unreleased` (Added, additive).

## Decisions (auto)

- One list (`oidc.providers`) and one callback route for both protocols, so the login page, cookie, buckets and route
  stay one each; the option name stays `oidc` (renaming it would break every app).
- A GitHub preset, not a generic OAuth 2.0 profile: a generic profile needs a mapping language for user endpoints;
  GitHub is the case asked for, and another provider can follow the same pattern.
- The nonce column is filled with an unused random value instead of a migration making it nullable.

## Progress

- [ ] Phase 1: provider entry, flow and fake
- [ ] Phase 2: docs
