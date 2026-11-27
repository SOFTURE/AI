# Research: mcp-access-client-name

## Findings
- `modules/mcp-access/src/contract.ts`: `McpServerIdentity { userId, canWrite, tokenId }`.
- `src/server/endpoint.ts`, `authenticate`: `verifyAccessToken` returns `{ tokenId, userId, canWrite, expiresAt,
  grantId }`; the identity travels through the SDK's `AuthInfo` (`clientId` = token id, `extra[USER_ID_CLAIM]` = user
  id) and `readIdentity` rebuilds it for the factory.
- `src/server/tokens.ts`, `findValidToken`: one select over `accessTokens` joined with `users`; it can also select
  `accessTokens.name` at no extra cost. `grantId` is null for a hand-issued token and set for an OAuth access token.
- `src/server/oauth.ts`, `issueGrantTokens`: an OAuth access token is stored with `name: clientName`, the client's
  registered name, which `parseClientRegistration` already cleans and cuts to 1-60 characters (the same value
  `OAuthGrantView.clientName` shows). A hand-issued token's name is the person's label ("Laptop").
- `findTokenClientName(ctx, tokenId)` (#804) answers the same name with a query per call; the README's `onToolCall`
  example uses it.
- `src/stdio/serve.ts` builds `{ userId, canWrite, tokenId: STDIO_TOKEN_ID }` (no token, no client).
- Identities are also built outside the endpoint: `src/testing/catalog.ts` and `src/testing/sessions.ts` (check
  helpers), many tests, and `@softure-ai/agent-ready`'s discovery identity (`McpDiscoveryIdentity`, its
  `McpServerFactory` takes an app's `createServer` "as is"; agent-ready accepts mcp-access `^0.2.0 ... ^0.7.0`).

## Options
1. Required `via` and `clientName`. An app's factory typed `(identity: McpServerIdentity)` then no longer fits
   agent-ready's `(identity: McpDiscoveryIdentity) => unknown` until agent-ready ships them too, and every identity an
   app builds in its tests breaks: a breaking type change.
2. Optional `via?` and `clientName?` in the type, always set by the endpoint (and the stdio entry). Nothing that builds
   identities breaks; the app reads `identity.clientName` and falls back only for identities it built itself.

Recommendation: option 2.
