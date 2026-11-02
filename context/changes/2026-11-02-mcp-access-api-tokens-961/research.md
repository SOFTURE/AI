# Research: mcp-access-api-tokens-961

## What exists
- `src/server/tokens.ts`: `issueAccessToken` (per-user advisory lock, expired rows of the issuer deleted, limit
  `maxTokensPerUser` over hand-issued rows), `listAccessTokens`, `revokeAccessToken` (owner in the `WHERE`),
  `verifyAccessToken` (shape check, sha256 lookup with the expiry in the query, `last_used_at` at most once a minute),
  `pruneAccessTokens` (every expired row). Imports only core, db, drizzle and the module's own options/schema.
- `mcp.access_tokens` (migration 0001, 0002 added `grant_id` for OAuth access tokens): no kind, no scopes; write
  access is the `can_write` column, effective only with `allowWrites` and the `mcp-access.writes_enabled` switch
  (`isWritingEnabled`, `src/server/writes-switch.ts`, no MCP SDK import).
- The MCP endpoint (`src/server/endpoint.ts`) counts the `mcp` bucket per client address before the lookup, answers
  401/429/503 itself. The SDK (`@modelcontextprotocol/server`) is imported by `endpoint`, `tools`, `tool-list`,
  `server-factory`, `server-info`, `strict-input`, `action-tool` and `stdio/serve` only.
- Token page: `issueToken` (`src/next/issue-token.ts`, optional `beforeIssue` gate), `getTokenManagerProps`,
  `McpAccessPage`, the client `TokenManager` (`src/ui/token-manager.tsx`), copy in `src/messages/en.ts`.
- Privacy contributor exports hand-issued tokens by name/dates and deletes all rows; `pruneMcpAccess` (jobs) prunes
  tokens and OAuth records.
- `@softure-ai/security`: `consumeRateLimit(ctx, { bucket, key })` returns `security.rate_limited` with
  `retryAfterSeconds`; bucket key kinds `ip`, `account`, `subject`; `subjectKey(value)` hashes a subject.
- UI: `Checkbox` has no `value` prop (sends `on`), `SegmentedControl` is a radio group with a `name`.

## Options considered
1. New package `@softure-ai/api-tokens` that `mcp-access` builds on: a clean dependency graph, but it moves the
   token table out of `mcp` (a data migration for every adopting app), duplicates the page and the privacy and prune
   wiring, and is a new package to set up and publish.
2. A second token kind inside `mcp-access`, with a `@softure-ai/mcp-access/tokens` entry point that loads no MCP SDK:
   the table, page, limit, privacy and prune already exist and cover both kinds with a column; the issue lists this as
   an acceptable shape.

Recommendation: option 2 (see plan D1).
