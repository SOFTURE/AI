# Research: mcp-access

Input: change.md, backlog-input.md. Depth: medium (token handling is security-critical). Sources:
FIRE_TRACKER (`src/db/access-tokens.ts`, `src/lib/mcp-auth.ts`, `src/lib/access-token-status.ts`,
`src/lib/mcp-client-config.ts`, `src/app/api/mcp/route.ts`, `src/app/actions/*tokens*.ts`, read
only), `@modelcontextprotocol/server` 2.3.0 type declarations, `modules/auth` (session token
hashing, `getCurrentUser`, `requireUser`), `modules/security` (`identifyClient`, `consumeRateLimit`),
`modules/feature-switches` (module layout), docs/02.

## Current state

- `modules/mcp-access/` is a stub: README and empty folders, no `package.json`.
- FIRE has the full flow: `access_tokens(id, user_id, name, token_hash, can_write, expires_at,
  last_used_at, created_at)`, 90-day tokens, 20 per account, expiry in the SQL query, a verifier
  for the SDK's `requireBearerAuth`, `createMcpHandler(..., { responseMode: "json" })` with the
  domain `createServer({ userId, canWrite })`, a rate limit counted before verification, and pure
  functions for the client snippets (Claude Code command, assistant prompt, JSON config,
  `mcp-remote` config for Claude Desktop, `claude-cli://` deep link).
- FIRE's limit check (count, then insert) runs outside a transaction: two parallel issues can pass
  the limit together. Its rate limit key falls back to a shared bucket without Cloudflare; security's
  `identifyClient` refuses instead.

## Answers to the roadmap unknowns

1. **SDK version range.** `@modelcontextprotocol/server` `^2.0.0` as a peer dependency (FIRE runs
   `^2.0.0`; 2.3.0 is current). The module needs `createMcpHandler`, `requireBearerAuth`,
   `OAuthError` and the `McpServer`/`Server` types, all present since 2.0.0. Peer, not a direct
   dependency: the app's factory returns an `McpServer` built from its own copy, and two copies
   would make the handler's types (and brand checks) disagree.
2. **OAuth for MCP.** Out of scope. Clients that send a static `Authorization: Bearer` header
   (Claude Code, Cursor, Claude Desktop through `mcp-remote`) are covered; OAuth discovery
   (RFC 9728 metadata, dynamic registration) is a later item. The 401 still carries the SDK's
   `WWW-Authenticate: Bearer` challenge.
3. **Tool catalog in the UI.** Declared in the module options (`tools: [{ name, access, description }]`
   with per-locale copy, like switch labels): the page renders it without loading the MCP server,
   and `softure.config.ts` stays free of the SDK. The app keeps the catalog next to its factory;
   a test in the example compares the two lists (tools/list against the catalog).

## Further decisions

- **Factory wiring:** the route is a factory, `createMcpRoute({ createServer })`, mounted as
  `export const POST = createMcpRoute({ createServer })`. The SDK and the domain tools stay out of the
  config file that `softure migrate` loads.
- **Effective write access:** `canWrite = allowWrites && token.can_write`, decided at verification,
  so turning `allowWrites` off disables every write token at once. Without `allowWrites` the page
  does not offer write tokens and the action stores `can_write = false`.
- **Token format:** `sftmcp_` + 32 random bytes in base64url (50 characters). The prefix lets
  secret scanners and people recognise a leaked token; the shape is checked before any lookup.
- **Per-account limit:** counted over unexpired tokens inside one transaction holding
  `pg_advisory_xact_lock` per user, so two parallel issues cannot both pass it. The user's expired
  tokens are deleted in the same transaction.
- **Expiry** sits in the SQL (`expires_at > now`) and in `AuthInfo.expiresAt` (seconds). Unknown,
  revoked and expired tokens get the same `invalid_token` answer.
- **`last_used_at`** is written on verification at most once a minute per token (a conditional
  `UPDATE`), and a failed write is logged without failing the request.
- **Rate limit:** bucket `mcp` (`MCP_RATE_LIMIT_BUCKETS`, 200 per 15 minutes per client address, as in FIRE),
  counted before verification. A database failure answers 503 with no detail; an unidentified client
  answers 400; a full bucket answers 429 with `Retry-After` (the fixed window knows its reset).
- **Body size:** the SDK's `maxRequestBodySize` (default 1 MiB here) answers 413 before parsing.
- **Revocation** deletes the row by `(user_id, id)`, so another user's id matches nothing.
