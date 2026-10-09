---
change_id: mcp-access-adopter-helpers
status: archived
---

# Plan: mcp-access adopter helpers (issue #315)

Input: change.md. Complexity: medium (seven small, independent additions, one package).

## Today (master `5b8b4ac`)

- No tool helpers: `examples/next-app/lib/mcp-server.ts` has its own `answer`/`failure`; an adopting app logs failed
  SQL with parameters and hands raw error text to the assistant. Core has `safeError`, `getPublicMessage`,
  `errorLogLabel`, `PublicError`.
- MCP SDK 2.3 ships `serveStdio(factory, { transport })` in `@modelcontextprotocol/server/stdio`, `isCallToolResult`,
  `InMemoryTransport` and `createMcpHandler` (used by the endpoint; `tools/list` works stateless).
- `getRequestOrigins` is already exported from `/next` (#311). Routes live only in the manifest literal.
- `issueTokenAction` is a `"use server"` export with no hook; `McpAccessPage` wires it in.
- `pruneAccessTokens` and `pruneOAuthRecords` exist; nothing runs them. `@softure-ai/mailing` ships the CLI pattern
  (`/cli` entry + bin over `@softure-ai/core/cli` `loadAppConfig`, `@softure-ai/db` `openCommandDatabase`), and the
  deploy tool runs any command as a `maintain` hook.

## Decisions

1. **Tool helpers** (`src/server/tools.ts`, from `/server`):
   - `toolResult(value)`: a string as text, anything else as JSON text.
   - `toolError(message)`: the same with `isError: true`.
   - `withToolErrors(work, { hints?, label? })`: runs `work`; a `CallToolResult` passes, a result value
     (`{ ok: true, value }` / `{ ok: false, error }`) becomes `toolResult(value)` / `toolError(hint or code)`, any
     other value `toolResult`. A thrown `PublicError` gives its message; anything else is logged by `errorLogLabel`
     only and answered with the hint for its `safeError` code, else a fixed English default. Never the error text.
2. **`actionTool(handler, { message?, hints? })`**: returns a tool callback. Arguments become `FormData` (strings as
   is, numbers and `true` as text (`true` → `"on"`, like a checkbox), `false`/`null`/`undefined` left out, arrays
   appended per item, dates as ISO, objects as JSON). The handler takes the form data (a `useActionState` action is
   called as `(form) => action(INITIAL, form)`). `{ ok: false, error }` or `{ status: "error", error }` → tool error
   through the hints; otherwise `message` (text or a function of the state), else the state as JSON. Wrapped in
   `withToolErrors`.
3. **Stdio** (new entry `/stdio`): `serveMcpStdio({ config, createServer, userIdEnv = "MCP_USER_ID",
   allowWrites = false, env, transport? })` → `Result<McpStdioHandle, McpStdioError>`. The account: the env id when
   set (must exist in `auth.users`), else the only account, else an error naming the env variable. `canWrite` =
   `allowWrites` and the config's `allowWrites`. The database is opened with `openCommandDatabase` and closed with
   the connection. `@softure-ai/mcp-access/stdio/register` (`node --import` / `tsx --import`) maps `server-only` to
   an empty module through `module.registerHooks`, so a factory that imports it runs outside Next.
4. **Catalog parity** (new entry `/testing`): `getToolCatalogDifferences(config, createServer)` lists the server's
   tools for a read and a write identity through `createMcpHandler` and reports `missing` (configured, not
   registered for the identity that should get it), `unlisted` (registered, not configured) and `writeForReaders` (a
   configured write tool a read identity gets).
   `expectToolCatalogMatchesServer` throws with the list. Framework-free, so any runner works. The tool schema takes
   optional localized `title` and `example`.
5. **Route constants**: `DEFAULT_MCP_ACCESS_ROUTES` from the root entry; the manifest reads it.
6. **Issue gate**: `issueToken(previous, formData, { beforeIssue? })` from `/next` (not a server action; the app
   calls it from its own `"use server"` file). `beforeIssue({ userId, canWrite })` returns a `Result<void,
   "mcp-access.issue_refused" | "mcp-access.write_refused">`; a refusal is returned before anything is issued, a
   throw is a `safeError` code. `issueTokenAction` delegates without a hook. `McpAccessPage` takes an optional
   `issueAction` prop. New messages for the two codes (en, pl).
7. **Pruning**: `pruneMcpAccess(ctx)` (`/server`) runs both prunes; `softure-mcp prune` (bin, `/cli` with
   `runMcpAccessCli`) loads the config like `softure-mail` and prints the counts. README shows the deploy `maintain`
   hook and says to drop inline pruning.

## Phase 1: tests first

`tests/adoption-gaps-315.test.ts`, one `describe` per decision; they fail on master (missing exports).

## Phase 2: implementation

Decisions 1 to 7, in that order. Example app uses `toolResult`/`withToolErrors`.

## Phase 3: docs and gates

README sections, CHANGELOG 0.1.13 section, `package.json` exports + bin, typecheck, lint, package tests, build.

## Progress

- [x] Phase 1: tests red on master (missing exports)
- [x] Phase 2: decisions 1 to 7; stdio closes the database on the client's close (impl review #1)
- [x] Phase 3: README, CHANGELOG, exports, bin, gates
