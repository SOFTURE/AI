---
change_id: mcp-access-challenge-scopes-553
---

# Research: mcp-access challenge scopes (issue #553)

## Findings

- `modules/mcp-access/src/server/endpoint.ts` `authenticate()` builds the challenge with
  `requiredScopes: [MCP_READ_SCOPE]` for both the OAuth and the Bearer-only shape. The SDK's
  `bearerAuthChallengeResponse` writes `scope="<requiredScopes joined by space>"` into `WWW-Authenticate`.
- `isWriteScopeRequested(scope)` in `oauth-http.ts` returns false for `null`, so an authorization request without
  `scope` is read-only. `validateAuthorizationRequest` stores the result as `isWriteRequested`; the consent page
  (`next/oauth-page.tsx`) offers the tick only when `isWriteRequested && allowWrites`, and the decision
  (`oauth-http.ts` ~535) grants writes only when request, `allowWrites` and the tick agree. So defaulting a missing
  scope to "write requested" never grants writes on its own.
- `isWriteScopeRequested` is exported from `@softure-ai/mcp-access/server`; its contract (a parser of a scope
  string) stays, the default lives in `validateAuthorizationRequest`, which has the config.
- `scopes_supported` in both metadata documents already lists both scopes.
- Tests: `tests/endpoint.test.ts` checks the 401 header shape; `tests/oauth-http.test.ts` checks
  `validateAuthorizationRequest` with `scope: "mcp:read mcp:write"`; `authorizationParams(…, { scope: null })`
  deletes the parameter.

## Spec

MCP authorization, scope selection: use the `scope` of the `WWW-Authenticate` challenge when present, otherwise all
of `scopes_supported`. RFC 6749 §3.3: when the client omits `scope`, the server either applies a documented default
or fails the request.
