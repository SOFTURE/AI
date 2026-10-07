# Plan: mcp-access-adoption-gaps

Input: change.md (research and framing skipped as separate files, reasons there). Complexity: high (an
authorization server, a migration, an adoption path, five phases).

## Today (master `88fc13c`)

- `verifyAccessToken` returns `null` for anything that is not `sftmcp_` + 43 base64url characters
  (`isAccessTokenShape`, `tokens.ts`), before any lookup. The hash is sha256 hex of the whole token, the same function
  an app with plain 64-hex tokens used, so only the shape check stands between those rows and a match.
- The endpoint answers `401` through `bearerAuthChallengeResponse(error, { requiredScopes })`; the SDK also takes
  `resourceMetadataUrl` and stamps it into `WWW-Authenticate` (`@modelcontextprotocol/server`, `index.d.mts:154`).
- `tokenLifetimeDays` (default 90) is the only lifetime. There is no OAuth: the README says so (§1, §12).
- `mcp.access_tokens` (migration `0001`): `id`, `user_id → auth.users ON DELETE CASCADE`, `name` (1-60, trimmed),
  `token_hash` (hex64, unique `access_tokens_token_hash_key`), `can_write`, `created_at`, `expires_at`,
  `last_used_at`, check `expires_at > created_at`; indexes `access_tokens_user_id_created_at_idx`,
  `access_tokens_expires_at_idx`. No column defaults except `id`.
- The adopting app's tables: `public.access_tokens` (same columns, `can_write DEFAULT false`, `created_at DEFAULT
  now()`, `grant_id → oauth_grants ON DELETE CASCADE`, indexes `access_tokens_by_user`, `access_tokens_by_grant`,
  unique `access_tokens_token_hash_unique`), `oauth_clients` (`client_id` unique, `client_name`, `redirect_uris jsonb`,
  `token_endpoint_auth_method`, `client_secret_hash`, `created_at`), `oauth_authorization_codes` (`code_hash` unique,
  `client_id → oauth_clients`, `user_id`, `redirect_uri`, `code_challenge`, `can_write`, `expires_at`, `used_at`,
  `created_at`), `oauth_grants` (one per user × client, `can_write`, `refresh_token_hash` unique,
  `previous_refresh_token_hash`, `refresh_expires_at`, `last_used_at`, `created_at`). Its access tokens are 64 hex,
  its OAuth access tokens are rows of `access_tokens` with `grant_id` and the client's name (up to 80 characters).
- `adoptModule` compares columns (type, nullability, default), constraints and indexes by name
  (`foundation/db/src/migrations/introspect.ts`), so an adoption migration must reproduce the module's DDL exactly.
- The example app mounts the token page and the endpoint; `e2e/migrations.spec.ts` lists every migration by name.

## Goal

`@softure-ai/mcp-access` 0.1.7 with all five points of issue #213.

**Out of scope:** publishing (the auto-release run after the merge), JWT access tokens and a JWKS document (tokens
stay opaque), OpenID Connect, token introspection and revocation endpoints (RFC 7662/7009), per-tool scopes.

## Key decisions

1. **Legacy shape** (point 1): option `legacyTokenPattern?: RegExp`. Schema check: anchored (`^…$`), no `g` or `y`
   flag (a stateful `lastIndex` would make every other check fail). `verifyAccessToken` looks a value up when it has
   the module's shape **or** matches the pattern; anything longer than 512 characters is refused before the regex
   runs. New tokens always get the prefix. `isAccessTokenShape` stays the module's own shape.
2. **OAuth is opt-in** (point 2): option `oauth: { enabled: false, … }`. Off, nothing changes for 0.1.6 apps (no
   routes to mount, the `401` stays as it is). On, the `401` carries `resource_metadata`, and the app mounts the
   OAuth routes and the consent page. Default off because an enabled AS whose routes are not mounted would send
   clients to 404s.
3. **Tables** (point 2, migration `0002_create_oauth_grants.sql`): `mcp.oauth_clients`, `mcp.oauth_authorization_codes`,
   `mcp.oauth_grants` with the adopting app's column names, plus `access_tokens.grant_id uuid REFERENCES
   mcp.oauth_grants ON DELETE CASCADE` and its index. Checks: secrets as hex64, auth method in the three RFC 7591
   values, a secret exactly when the method is not `none`, `redirect_uris` a non-empty JSON array, a code challenge of
   43 base64url characters, a client name of 1-60 characters (it becomes the access token's name), `expires_at >
   created_at`. One grant per user × client (`oauth_grants_user_id_client_id_key`).
4. **Secrets**: access tokens keep `sftmcp_`; refresh tokens `sftmcr_`, codes `sftmca_`, client secrets `sftmcs_`, all
   32 random bytes base64url, stored as sha256 hex. Client ids are `sftmc_` + 16 random bytes (not a secret). Refresh
   tokens and codes are looked up by hash with only a length cap (512), so refresh tokens an adopting app issued keep
   working.
5. **Flows** (lifted from the adopter, generalised onto the module context and clock):
   - registration (RFC 7591): public, counted in bucket `mcp-oauth` per client address; `redirect_uris` 1-10, `https`
     anywhere, `http` only on loopback, a native app scheme outside a deny list, never a fragment; name without
     control characters, cut to 60, else the first redirect host; method default `client_secret_basic` (RFC);
     clients older than a day without a grant are deleted on each registration;
   - authorize: the client and the redirect URI are confirmed before any error goes back to the client (otherwise
     the error page; never an open redirect); then `response_type=code`, PKCE `S256` only, `resource` (RFC 8707) if
     present must be the endpoint URL or the app origin. The consent page shows the client, where the code goes (host
     for http(s), the whole URI for a native scheme), the account and the access; write is offered only when the
     client asked for `mcp:write` **and** the app allows writes, and granted only when the person ticks it;
   - decision (`POST`, `303`): same-origin `Origin` required, the request re-validated from the form, a session
     required (else back to the consent page); deny → `access_denied`; every redirect carries `state` and `iss`
     (RFC 9207);
   - token (`authorization_code`): the code is burned by a conditional `UPDATE … WHERE used_at IS NULL` before PKCE
     is checked; a reused code revokes the grant issued from it (RFC 6749 §4.1.2); a re-authorization of the same
     client replaces the grant (its tokens go by cascade); one `invalid_grant` for every refusal;
   - token (`refresh_token`): rotation, the old hash moves to `previous_refresh_token_hash` in the same conditional
     `UPDATE`; presenting a rotated token deletes the whole grant (OAuth 2.1 §4.3.1); the grant's expired access tokens
     are deleted on each refresh;
   - client authentication: `none` (PKCE only), `client_secret_post`, `client_secret_basic` (form-encoded per RFC 6749
     §2.3.1), constant-time compare; `invalid_client` with `WWW-Authenticate: Basic` when Basic was used;
   - the token endpoint is counted per address and `client_id` (several assistants share an address);
   - CORS `*` on registration and token (no cookies read there), `no-store` on every credential response.
6. **Lifetimes** (point 3): `tokenLifetimeDays` stays the hand-issued lifetime. `oauth.accessTokenLifetimeMinutes`
   (default 60, 5-1440), `oauth.refreshTokenLifetimeDays` (default 90, 1-365, counted from the last refresh),
   `oauth.authorizationCodeLifetimeMinutes` (default 10, 1-10, RFC 6749 §4.1.2 recommends at most 10).
7. **Connected apps** (point 2): `listOAuthGrants`, `revokeOAuthGrant` (owner in the `WHERE`); the token page shows the
   grants (client name, read or read-and-change, connected on, last used) with a disconnect button
   (`revokeGrantAction`); OAuth access tokens are not listed with the hand-issued tokens and do not count against
   `maxTokensPerUser` (`grant_id IS NULL` in both). Verification records `last_used_at` on the grant too (at most once
   a minute).
8. **Metadata**: issuer = `appOrigin`; resource = the endpoint URL. AS metadata (RFC 8414) with `S256`,
   `authorization_response_iss_parameter_supported`, auth methods, grant types, scopes. Protected resource metadata
   (RFC 9728) at the path variant `/.well-known/oauth-protected-resource<endpoint>` (the URL in the `401`) and at the
   root (`resource` = the origin, RFC 9728 §3.3).
9. **Routes** (manifest): `oauthConsent: /oauth/authorize`, `oauthDecision: /api/oauth/authorize`, `oauthToken:
   /api/oauth/token`, `oauthRegister: /api/oauth/register`; well-known paths are fixed by the RFCs. New mount entries
   for the page and the six route files. Next exports: `OAuthConsentPage`, `getAuthorizationServerMetadataRoute`,
   `getProtectedResourceMetadataRoute`, `registerOAuthClientRoute`, `exchangeOAuthTokenRoute`,
   `decideOAuthAuthorizationRoute`, `answerOAuthPreflight`, `revokeGrantAction`. The server layer takes a `Request` and
   returns a `Response` (`/server`), so other hosts can mount it.
10. **Privacy**: export adds `oauthGrants` (client name, write flag, dates); deletion removes the user's grants and
    codes before the tokens. Never a hash.
11. **Adoption** (point 4): README §5 gets the adoption migration an app writes (move the four tables into `mcp`,
    rename constraints and indexes to the module's names, drop the app's defaults, cut names to 60, add the checks)
    and `baseline: { "mcp-access": 2 }`. A test runs that SQL on the adopter's real shape with rows, adopts through
    `adoptModule`, and then verifies a legacy token, an OAuth access token and a refresh of a legacy refresh token.
12. **Writes** (point 5): README §3 says `allowWrites: process.env.MCP_ALLOW_WRITES === "1"` is the intended way to
    keep the deployment switch in the environment.
13. **Versions**: 0.1.7 (package.json, module.json, manifest, CHANGELOG). Additive migration, like earlier 0.1.x
    migrations.

## Phase 1: legacy shape and lifetimes options (TDD)

Points 1 and 3 (options only) in `options.ts`, `server/tokens.ts`.

- `tests/tokens.test.ts`: a 64-hex token inserted by hash verifies with `legacyTokenPattern`, not without; a value
  over 512 characters is refused without a query; new tokens keep the prefix.
- `tests/module.test.ts`: defaults include `oauth`; an unanchored pattern, a `g` or `y` flag, lifetimes out of range
  are refused.

## Phase 2: OAuth data layer and migration (TDD)

Points 2 and 3 in migration `0002`, `schema.ts`, `server/oauth.ts` (clients, codes, grants, exchange, refresh,
list, revoke, prune), `server/pkce.ts`, `server/tokens.ts` (`grant_id` filters, grant last use), `server/privacy.ts`.

- `tests/oauth.test.ts`: registration (secret only for confidential clients); code exchange with PKCE; a wrong
  verifier burns the code; a reused code revokes the grant; another client or redirect is refused; refresh rotates;
  a rotated token revokes the grant; expiry of code, access token and refresh token with the test clock and the
  configured lifetimes; re-authorization replaces the grant; revoke removes the grant's access tokens; listing is
  per owner; stale clients are pruned, clients with a grant are not.
- `tests/tokens.test.ts`: grant tokens are not listed and do not count toward the limit.
- `tests/privacy.test.ts`: export lists grants, deletion removes them.

## Phase 3: HTTP layer

`server/oauth-http.ts` (registration, token, authorize validation and decision, metadata), `server/endpoint.ts`
(`resource_metadata`), `server/options.ts` (routes, URLs).

- `tests/oauth-http.test.ts`: metadata documents; registration answers (201, invalid redirect, invalid JSON, rate
  limit 429); token endpoint (Basic and post auth, `invalid_client`, `invalid_grant`, `unsupported_grant_type`,
  `invalid_target`, rate limit per client); authorize validation order (unknown client and bad redirect shown, never
  redirected; later errors redirected with `state` and `iss`); decision (cross-origin 403, no session back to the
  page, deny, allow with and without write, write ignored when the app disallows it).
- `tests/endpoint.test.ts`: with OAuth on, `401` carries `resource_metadata`; off, it does not; an OAuth access token
  serves the factory with the grant's write flag.

## Phase 4: Next adapter and UI

`next/oauth-routes.ts`, `next/oauth-page.tsx`, `next/actions.ts` (`revokeGrantAction`), `next/pages.tsx` and
`ui/token-manager.tsx` (connected apps section), `ui/consent-form.tsx`, messages en/pl, manifest routes and mount,
`module.json`.

- `tests/token-manager.test.tsx`: connected apps render and the disconnect form posts the grant id.
- `tests/messages.test.ts`: both dictionaries complete.
- `tests/module.test.ts`: routes and mount.
- Example app: OAuth on, routes and page mounted, `e2e/mcp-oauth.spec.ts` (register → consent → code → token → tool
  call → refresh → disconnect on the page → 401), `e2e/migrations.spec.ts` lists `0002`.

## Phase 5: adoption, docs, version

- `tests/adoption.test.ts`: the adopter's tables with rows in `public`, the README's adoption SQL, `adoptModule` →
  adopted 1..2 with no differences; a legacy token and the legacy refresh token work afterwards.
- README (§1, §3 options and `allowWrites`, §4 mounting, §5 tables and adoption, §10, §11, §12), CHANGELOG, versions.

Done when: `npm run typecheck`, `lint`, `test`, `build` green; the example e2e green in CI.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: legacy shape and lifetimes options

- [ ] legacyTokenPattern option and verification
- [ ] oauth options with lifetimes

### Phase 2: OAuth data layer and migration

- [ ] migration 0002 and schema
- [ ] clients, codes, grants, exchange, refresh, revoke, prune
- [ ] grant tokens out of the token list and limit
- [ ] privacy export and deletion

### Phase 3: HTTP layer

- [ ] metadata, registration and token endpoints
- [ ] authorize validation and decision
- [ ] resource_metadata on the 401

### Phase 4: Next adapter and UI

- [ ] routes, consent page and revoke action
- [ ] connected apps on the token page
- [ ] example app and e2e

### Phase 5: adoption, docs, version

- [ ] adoption test
- [ ] README, CHANGELOG, versions
