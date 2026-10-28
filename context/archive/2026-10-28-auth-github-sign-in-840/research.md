# Research: GitHub sign-in (issue #840)

## Current code

- `modules/auth/src/options.ts`: `oidcProviderSchema` is one strict object with a required `issuer`; the allowlist
  refinement and the `requireHostedDomain` default sit on it. Errors are reported per field (tests in
  `tests/module.test.ts` assert the messages), so a plain `z.union` would replace them with one "Invalid input".
  A `z.discriminatedUnion("type", …)` whose OpenID Connect member has `type: z.literal("oidc").default("oidc")`
  parses entries without `type` (checked with zod 4 in this repo) and keeps per-field messages.
- `src/server/oidc/flow.ts`: `startOidcSignIn` and `completeOidcSignIn` do the shared work (rate limits, state row,
  cookie check, one-time consume, `resolveOidcAccount`, session); only discovery, token exchange and ID token checks
  are OpenID Connect specific. `getAllowedEmail(provider, claims)` is the allowlist.
- `src/server/oidc/token-request.ts`: the exchange through core's `requestJson` (no redirects, timeout, `oidc.fetch`).
  `requestJson` takes extra headers and GET reads, and sets `Accept: application/json` unless given.
- `auth.oidc_states.nonce` is `NOT NULL`; a GitHub sign-in stores a random nonce it never sends (no schema change).
- `src/testing/oidc-provider.ts`: the fake OpenID Connect provider (fetch router + `signIn(authorizeUrl, user)`).

## GitHub OAuth App (docs.github.com, "Authorizing OAuth apps")

- Authorize: `https://github.com/login/oauth/authorize` with `client_id`, `redirect_uri`, `scope`, `state`,
  `code_challenge`, `code_challenge_method=S256` (PKCE supported), optional `allow_signup`, `prompt=select_account`.
  A refusal returns `error=access_denied` to the callback.
- Token: `POST https://github.com/login/oauth/access_token` with `client_id`, `client_secret`, `code`,
  `redirect_uri`, `code_verifier`; `Accept: application/json` gives JSON, otherwise a form-encoded body. Errors
  (`bad_verification_code`, `incorrect_client_credentials`, `redirect_uri_mismatch`) come with status 200 and an
  `error` field.
- `GET https://api.github.com/user` (`Authorization: Bearer`, `Accept: application/vnd.github+json`,
  `X-GitHub-Api-Version: 2022-11-28`, a `User-Agent` is required): numeric `id`, `login`, `name` (nullable).
- `GET https://api.github.com/user/emails` (scope `user:email`): `[{ email, primary, verified, visibility }]`.
- No ID token, no JWKS, no discovery document, no hosted domain claim.

## Options

1. A separate `github` option beside `oidc`: duplicates routes, buckets, cookie and copy. Rejected.
2. A `type: "github"` entry in `oidc.providers` with a protocol switch inside the shared flow (the issue's proposal).
   Chosen.
