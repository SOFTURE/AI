# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/mcp-access`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`mcp-access@x.y.z`).

## 0.1.9

- The OAuth registration, token and consent decision routes read their body through `readSmallBody`
  with a cap, `oauth.maxBodyBytes` (default 16 KiB, 1 KiB to 1 MiB). A larger body, announced or
  streamed, is answered with `413` (`invalid_request` on registration and token, an empty `413` on
  the decision) before it fills memory; an oversized token request still counts in the `mcp-oauth`
  bucket, per address. Unreadable bodies (cut off, not UTF-8) get the answer each route gave before.
  The consent form is parsed from the capped text, so urlencoded and multipart forms both work.

## 0.1.8

- OAuth URLs follow the request: `resolveAppOrigin(request)` (with `readRequestOrigin`, which reads
  `Host` and `X-Forwarded-Proto`) sets the app origin per request for the issuer, the endpoints in
  the metadata, `resource`, `resource_metadata` in the endpoint's `401`, `iss` and the consent
  decision's `Origin` check. Without it nothing changes.
- `resourceOrigins`: other public hosts; the root protected resource metadata asked on one names it
  as `resource`, and the authorization and token endpoints accept it.
- `oauth.metadata.authorizationServer` / `.protectedResource`: extra discovery keys (an object, or
  a function of the request's origins); generated keys win, `resource_name` can be replaced.
- Discovery documents carry `Vary: host, x-forwarded-proto`; `getAuthorizationServerMetadataRoute`
  now reads the request (re-exporting it as `GET` keeps working).
- New exports: `createMcpAccessContext` and `resolveMcpOrigins` (`/server`), `getMcpAccessContext`
  (`/next`), `OAuthClientRow`, `McpOrigins` and `readRequestOrigin` (root and `/server`). URL
  builders take the origins as an optional last argument.

## 0.1.7

- OAuth 2.1 for MCP clients, opt-in (`oauth.enabled`): protected resource and authorization server
  metadata, `resource_metadata` in the endpoint's `401`, dynamic client registration, a consent
  page with PKCE `S256`, a token endpoint with rotating refresh tokens and replay detection, and a
  connected apps list whose revoke deletes the grant's access tokens. Mount the new routes and the
  consent page (README §4) and add `"mcp-oauth"` from `MCP_RATE_LIMIT_BUCKETS` to the security buckets.
- Separate lifetimes: `tokenLifetimeDays` for hand-issued tokens, `oauth.accessTokenLifetimeMinutes`,
  `oauth.refreshTokenLifetimeDays` and `oauth.authorizationCodeLifetimeMinutes` for OAuth.
- `legacyTokenPattern`: tokens an app issued before adopting the module keep working.
- Migration 2 (`create_oauth_grants`) adds the OAuth tables and `access_tokens.grant_id`.
- `adoption/move-app-tables.sql`: moves an app's own token and OAuth tables into `mcp` for
  `baseline: { "mcp-access": 2 }` (README §5).

## 0.1.6

- Adapters use the configured database handle; `@softure-ai/ui` is a peer dependency.
