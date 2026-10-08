# Plan: mcp-access-oauth-hosts

Input: change.md (research and framing skipped, reasons there). Complexity: medium (three phases).

## Today (master `6da46f0`)

- `getOAuthIssuer(config)` is `new URL(config.appOrigin).origin`; `getMcpEndpointUrl(config)` joins the endpoint route
  to `config.appOrigin`. Every URL builder in `server/oauth-http.ts` (authorization server metadata, protected resource
  metadata, `isAcceptableResource`, `buildClientRedirect`'s `iss`, `getProtectedResourceMetadataUrl`) and the
  `isSameOrigin` check of `handleAuthorizationDecision` call these two only.
- The endpoint's `401` (`server/endpoint.ts`) names `getProtectedResourceMetadataUrl(ctx.config)`.
- `/next`: `getProtectedResourceMetadataRoute` picks the root/endpoint variant from the request path; discovery routes
  pass only the config; the consent page validates without a request; the token page action builds the setup snippets
  from `getMcpEndpointUrl(config)`.
- The documents are closed object literals; nothing merges app keys.
- `getMcpAccessContext` lives in `next/context.ts` and is not exported; `OAuthClientRow` is exported from neither
  entry point though `findOAuthClient`, `isClientSecretValid` and `RefreshOAuthGrantInput` use it.

## Goal

`@softure-ai/mcp-access` 0.1.8 with all three points of #234; behaviour without the new options identical to 0.1.7.

**Out of scope:** a token introspection/revocation endpoint, `jwks_uri` served by the package (an app adds the key and
its own route through the metadata extension), the analytics-style link keeper.

## Key decisions

- **`McpOrigins`** `{ appOrigin: string; resourceOrigins: readonly string[] }` (bare origins). Resolved per request by
  `resolveMcpOrigins(config, request?)` in `/server`: `appOrigin` = the option `resolveAppOrigin(request)` when set and
  not null, else `config.appOrigin`; reduced with `new URL().origin`, and a value that is not a bare http(s) origin
  throws an error naming the option (a setup bug). Without a request: `config.appOrigin`.
- **`resolveAppOrigin?: (request: McpOriginRequest) => string | null`** (option, `z.custom` function like analytics'
  `channelFromReferer`). `McpOriginRequest = { url: string; headers: { get(name): string | null } }`, so a `Request`
  and Next's `headers()` both fit. Helper **`readRequestOrigin(request)`**: `X-Forwarded-Proto` (first value, http or
  https) else the URL's scheme, plus `Host` else the URL's host. Intended use:
  `resolveAppOrigin: process.env.APP_ORIGIN ? undefined : readRequestOrigin`.
- **`resourceOrigins: string[]`** (option, ≤ 16 bare http(s) origins, default `[]`, same schema as analytics'
  `origins`): extra public hosts. Root protected resource metadata announces the origin the request was sent to when
  `Host` (else the URL's host) matches one of them (ties broken by `X-Forwarded-Proto`), else `appOrigin`; the
  endpoint variant always names the endpoint on `appOrigin`. `authorization_servers` is always `[appOrigin]`.
  `isAcceptableResource` also accepts each resource origin with or without a trailing slash.
- **Signatures:** every public function that builds a URL gets an optional trailing `origins: McpOrigins`
  (default: `resolveMcpOrigins(config)`): `getOAuthIssuer`, `getProtectedResourceMetadataUrl`,
  `getAuthorizationServerMetadata`, `getProtectedResourceMetadata(config, variant, origins?, servedOrigin?)`,
  `isAcceptableResource`, `buildClientRedirect`, `getMcpEndpointUrl`; `validateAuthorizationRequest(ctx, params,
  origins?)`. The handlers (`handleTokenRequest`, `handleAuthorizationDecision`, the endpoint) resolve from their
  `Request`. `serveDiscoveryDocument(config, document, request?)` passes `(config, origins, request)` to `document`.
- **Discovery caching:** documents keep `public, max-age=300` and add `vary: host, x-forwarded-proto`, since the root
  document now depends on them.
- **Consent page and token page:** build a `McpOriginRequest` from Next's `headers()` and the route's URL on
  `config.appOrigin`, so the hidden `resource`, the redirect `iss` and the setup snippets use the same origin as the
  routes.
- **Metadata extensions:** `oauth.metadata: { authorizationServer?, protectedResource? }`, each a JSON object or a
  function `(origins: McpOrigins) => Record<string, unknown>`. Merged as `{ ...extension, ...generated }`, except
  `resource_name`, which the protected resource extension may replace. A static extension that sets a generated key
  (other than `resource_name`) is refused at startup by name; a function's generated keys are overwritten silently
  (documented).
- **Context:** `createMcpAccessContext(config)` in `/server` (`server/context.ts`, the body of today's `/next`
  helper); `/next` keeps `getMcpAccessContext(config = getSoftureConfig())` on top of it and exports it.
- **Types:** `OAuthClientRow` and `OAuthTokenEndpointAuthMethod` exported from the root and `/server`; `McpOrigins`,
  `McpOriginRequest`, `McpMetadataExtension` from the root and `/server`.

## Phases

### Phase 1: origins (TDD)

- `src/options.ts`: `resolveAppOrigin`, `resourceOrigins` with their schemas.
- `src/server/origins.ts`: `McpOrigins`, `McpOriginRequest`, `resolveMcpOrigins`, `readRequestOrigin`,
  `selectServedOrigin(origins, request)`.
- `src/server/options.ts`, `src/server/oauth-http.ts`, `src/server/endpoint.ts`: thread `origins` through.
- `/next`: routes pass the request; consent page and token action resolve from `headers()`.
- Tests: default unchanged; resolver drives issuer, metadata, `resource_metadata`, `iss`, accepted `resource` and the
  `Origin` check (a 6510 port case end to end: register → decide → token); root metadata on an extra host announces
  it and the token endpoint accepts it; a `Host` not configured falls back to `appOrigin`; a resolver returning a
  path or `ftp:` throws by name; `readRequestOrigin` reads `Host` and `X-Forwarded-Proto`; option validation.

Done when: gates green; the old tests pass unchanged.

### Phase 2: metadata extensions (TDD)

- `src/options.ts`: `oauth.metadata` schema with the protected-key refinement.
- `getAuthorizationServerMetadata` / `getProtectedResourceMetadata` merge the extension.
- Tests: static keys appear; a function receives the request's origins; generated keys win; `resource_name` can be
  replaced; a static `issuer` is refused at startup by name.

Done when: gates green.

### Phase 3: exports, docs, version

- `src/server/context.ts` + exports; `OAuthClientRow` etc. exported; `/next` exports `getMcpAccessContext`.
- README §3 (options), §4 (two hosts, image served elsewhere, proxy note), §12; CHANGELOG 0.1.8; version 0.1.8 in
  `package.json`, `module.json`, manifest; example app keeps building.
- Tests: the context helper builds a working context; type-level use of `OAuthClientRow` from the root.

Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

- [x] Phase 1: origins
- [x] Phase 2: metadata extensions
- [x] Phase 3: exports, docs, version (the adoption test now reads the version from package.json instead of pinning 0.1.7)

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; `npm test` 5012 passed with one
failure (the adoption test pinned `0.1.7`), fixed and re-run: mcp-access 201/201. One commit for the three phases
(the phases share files; the PR is the unit).
