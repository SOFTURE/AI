---
change_id: mcp-access-tool-call-hook-804
---

# Research: a hook around each tool call (issue #804)

## Findings

- `modules/mcp-access/src/server/tools.ts`: `withToolErrors(work, { hints?, label? })` runs the work and answers it.
  A returned `CallToolResult` passes; a core result is unwrapped (`ok` → `toolResult(value)`, else `toolError` with
  the hint for the code); a thrown `PublicError` gives its message; anything else is logged by kind and answered with
  the hint for its `safeError` code (`core.database_failed`, `core.unexpected`). The code is gone once the answer is
  built: only the hint text remains.
- `src/server/action-tool.ts`: `actionTool(handler, { message?, hints?, label? })` wraps the work in
  `withToolErrors` but turns an error state into `toolError(describeCode(...))` itself, so `withToolErrors` never
  sees the code. Returning `{ ok: false, error }` instead gives the same answer through `answerValue` (same
  `describeCode` with the same hints) and keeps the code visible.
- `src/contract.ts`: `McpServerIdentity { userId, canWrite, tokenId }` reaches the app's factory once per request
  (`src/server/endpoint.ts`, `readIdentity`). The token's name is not in it; `verifyAccessToken` does not select it.
  Stdio passes `tokenId: "stdio"` (`STDIO_TOKEN_ID`), which is not a uuid: `mcp.access_tokens.id` is `uuid`, so a
  lookup by that id would fail in Postgres.
- Tool names: the SDK's `registerTool(name, …, callback)` does not hand the name to the callback; the module only
  knows it from `label`.
- Core: `safeError(error).error` is a `CoreErrorCode`; `getPublicMessage(error)` is non-null for a `PublicError`.
- Tests: `tests/adoption-gaps-315.test.ts` covers `withToolErrors`/`actionTool` without a database; `tests/tokens.test.ts`
  covers token queries on PGlite through `tests/support.ts`.

## Options

1. Hook on `withToolErrors` / `actionTool` options, with a per-request caller (`tokenId`, `clientName`) the app
   builds in its factory, plus `findTokenClientName(ctx, tokenId)`. Small, additive, works for stdio too.
2. Hook on `createMcpEndpoint`, wrapping every registered tool. Needs to intercept `McpServer.registerTool` or the
   JSON-RPC stream, does not cover stdio, and still loses the code inside `withToolErrors`.
3. Add `clientName` to `McpServerIdentity`. A contract change for every factory and test identity.

Recommendation: option 1.
