---
change_id: auth-github-sign-in-840
status: done
---

# Research

## Where the protocol step sits

- `src/server/oidc/flow.ts`: `startOidcSignIn` reads discovery (`getProviderMetadata`) for the authorize endpoint;
  `completeOidcSignIn` consumes the state row, exchanges the code (`exchangeCode`, reads only `id_token`), verifies
  the token (`decodeIdToken`, `findSigningKey`, `isSignedBy`, `checkIdTokenClaims`), checks `getAllowedEmail`, then
  `resolveOidcAccount` and `createSession`. Only discovery, the exchange and the token checks are OpenID Connect
  specific; everything before and after is protocol free.
- `src/options.ts`: `oidcProviderSchema` (strict object, `issuer` required, a transform for `requireHostedDomain`, a
  refine for the allowlist). Fields read elsewhere: `id`, `name`, `clientIdEnv`, `clientSecretEnv`, `clientAuth`,
  `scopes`, `authorizeParams`, `allowedDomains`, `allowedEmails`, `requireHostedDomain`, `createAccounts`. Only
  `discovery.ts` and `flow.ts` read `issuer`.
- `auth.oidc_states.nonce` is NOT NULL: a GitHub sign-in stores the nonce it never sends (harmless, one random value).
- `src/testing/oidc-provider.ts`: the fake provider routes by URL through `oidc.fetch`; a GitHub fake can do the same
  for `github.com` and `api.github.com`.

## GitHub OAuth App (docs.github.com, "Authorizing OAuth apps")

- Authorize: `GET https://github.com/login/oauth/authorize` with `client_id`, `redirect_uri`, `scope`, `state`,
  `code_challenge`, `code_challenge_method=S256` (PKCE is supported for OAuth Apps), optional `login`, `allow_signup`.
- Token: `POST https://github.com/login/oauth/access_token` with `client_id`, `client_secret`, `code`,
  `redirect_uri`, `code_verifier`; `Accept: application/json` answers `{ access_token, token_type, scope }`. An error
  (`bad_verification_code`, `incorrect_client_credentials`, `redirect_uri_mismatch`) comes back with status 200 and
  `{ error, error_description }`.
- `GET https://api.github.com/user` (`Authorization: Bearer`, `Accept: application/vnd.github+json`, a `User-Agent` is
  required): `id` (number, stable), `login`, `name` (nullable).
- `GET https://api.github.com/user/emails` (scope `user:email`): `[{ email, primary, verified, visibility }]`.
- Callback errors: `error=access_denied` when the person cancels, same as OpenID Connect.

## Zod

`z.discriminatedUnion("type", [github, oidc])` with `type: z.literal("oidc").default("oidc")` parses an entry without
`type` as OpenID Connect and keeps field errors precise (checked with zod 4 in this repo).
