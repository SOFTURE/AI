---
change_id: mcp-access-tool-call-hook-804
status: archived
---

# Plan: an optional onToolCall hook around each tool call (issue #804)

Input: change.md, research.md. Complexity: small (two source files, one query, tests, docs).

## Phase 1: the hook in withToolErrors and actionTool

Files: `modules/mcp-access/src/server/tools.ts`, `src/server/action-tool.ts`, `src/server/index.ts`,
`tests/tool-call-hook-804.test.ts`.

1. Tests first: the record for a succeeded call (item count for an array value, `null` otherwise), a failed result
   (its code), an action error state (its code), a thrown error (its `safeError` code) and a thrown `PublicError`
   (code `null`); argument names only; start and duration from the clock; a throwing or rejecting hook leaves the
   answer unchanged and is logged by kind; no hook, no change.
2. Types in `tools.ts`: `ToolCallOutcome` (`succeeded { itemCount }` | `failed { code }` | `thrown { code }`),
   `ToolCallRecord { tool, tokenId, clientName, argumentNames, outcome, startedAt, durationMs }`, `ToolCaller
   { tokenId, clientName }`, `ToolCallHook`. New `ToolErrorOptions` fields: `onToolCall?`, `caller?`, `args?`.
3. `withToolErrors` times the work, derives the outcome next to the answer, awaits the hook in a try/catch and returns
   the same answer. A returned `CallToolResult` counts as `succeeded` (no item count) or `failed` with code `null`
   when `isError`.
4. `actionTool`: returns `{ ok: false, error }` for an error state so the code reaches the record; passes
   `onToolCall`, `caller` and the tool's arguments through.
5. Export the new types from `/server`.

## Phase 2: findTokenClientName

Files: `src/server/tokens.ts`, `src/server/index.ts`, `tests/tool-call-hook-804.test.ts`.

1. Tests first: the name of an issued token; `null` for an unknown id, a non-uuid id (`"stdio"`) and a pruned token.
2. `findTokenClientName(ctx, tokenId)`: one select of `name` by `id`; a non-uuid id returns `null` without a query.

## Phase 3: docs

Files: `modules/mcp-access/README.md`, `modules/mcp-access/CHANGELOG.md`.

1. README "Writing tools": the hook, the record, the caller built in the factory, and that the hook never changes
   the answer.
2. CHANGELOG `## Unreleased`: the addition and how an app drops its own wrapper.

## Decisions (auto)

- Option 1 of research.md: the hook on `withToolErrors` / `actionTool`, not on `createMcpEndpoint`.
- The caller is passed per tool call (`caller`), built once per request in the app's factory; `tokenId` and
  `clientName` are `null` when the app passes none.
- `thrown` with code `null` for a `PublicError`: it carries a deliberate message, no code.
- The hook is awaited (serverless hosts may stop after the answer), inside a try/catch; its failure is logged by kind.
- Times come from `Date.now()`, so tests drive them with fake timers.
- Additive minor-level change; the coordinator picks the version at release.

## Progress

- [x] Phase 1: the hook in withToolErrors and actionTool (d28f65c)
- [x] Phase 2: findTokenClientName (d28f65c, one commit with phase 1: the test file covers both)
- [x] Phase 3: README and CHANGELOG (6168632)
