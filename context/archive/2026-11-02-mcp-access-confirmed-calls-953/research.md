# Research: confirmed tool calls in mcp-access (issue #953)

Read: `modules/mcp-access/src/server/tools.ts`, `action-tool.ts`, `strict-input.ts`, `writes-switch.ts`,
`server-factory.ts`, `endpoint.ts`, `prune.ts`, `health.ts`, `privacy.ts`, `src/contract.ts`, `src/schema.ts`,
`src/messages/en.ts`, the migrations, `module.json`, README §4–§12, and `modules/mailing/src/server/unsubscribe-link.ts`
(the repository's existing HMAC secret pattern).

## Findings

1. A tool callback is `(args, ctx) => CallToolResult`; `withToolErrors(work, options)` is the safe boundary and the
   only place that builds the `onToolCall` record (`ToolCallRecord`: tool, tokenId, clientName, argumentNames,
   outcome, startedAt, durationMs). A refusal returned as `{ ok: false, error: code }` is answered through `hints`
   and recorded as `failed` with that code.
2. The app's `registerTools(server, identity)` gets `McpServerIdentity` (`userId`, `canWrite`, `tokenId`): the
   account and the access token a confirmation must be bound to. The database comes from the app's module context
   (`McpAccessContext`, `{ db, clock, config }`), which the app already builds for its own queries.
3. Strict input (`withStrictToolInput`) refuses fields a schema does not list, so `confirmation` must be in the
   tool's input schema; a shared optional string schema keeps every confirmed tool the same.
4. Secrets: the repository's pattern (mailing) is an environment variable of at least 32 characters, read on every
   use, an HMAC with a domain-separation prefix and `timingSafeEqual` after a shape check. The module declares it in
   `manifest.env` as not required.
5. Single use needs state. The OAuth codes use `used_at` on their own rows; a stateless HMAC token has no row, so a
   small table of used token hashes (with the token's expiry, for pruning) is enough. A conflict-free insert
   (`ON CONFLICT DO NOTHING RETURNING`) consumes a token atomically, so two parallel second calls run once.
6. `pruneMcpAccess` already runs every prune of the module (CLI, jobs handler); `checkAccessTokensTable` reads each
   table with `limit 0`.
7. Messages: `getMcpAccessMessages(config)` gives the app's overrides; strict input keeps its refusal texts in
   `toolInput` of the dictionary, with the stable code at the start of the text (`input.field_renamed: …`).

## Options

1. Pending confirmations stored as rows (random token, bound fields in columns): no secret, but a write on every
   estimate call and a different design than the issue's proposal. Not taken.
2. The issue's design: a stateless HMAC token carrying the bound fields' digests (so each mismatch has its own
   code), signed with `MCP_CONFIRMATION_SECRET`; used tokens stored by hash in `mcp.used_confirmations`. Taken.
