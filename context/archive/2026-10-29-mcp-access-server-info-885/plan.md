---
change_id: mcp-access-server-info-885
status: archived
---

# Plan: get_server_info tool (issue #885)

Input: change.md, research.md. Complexity: small (one new server file, a factory option, a dictionary entry, docs).

## Phase 1: tool and factory option (TDD)

Files: `modules/mcp-access/src/server/server-info.ts` (new), `src/server/server-factory.ts`, `src/server/index.ts`,
`src/messages/en.ts`, `tests/server-info-tool-885.test.ts` (new).

- `SERVER_INFO_TOOL_NAME = "get_server_info"`.
- `ServerInfoToolOptions { buildInfo: () => McpBuildInfo | Promise<McpBuildInfo>; changelog?: () => unknown;
  description?: string }`, where `McpBuildInfo` is structural (`release`, `commit`, `builtAt`, `startedAt`), so
  `readBuildInfo` of ops is assignable as it is.
- `registerServerInfoTool(server, { ...options, server: { name, version } })`: a tool with no input fields,
  `readOnlyHint` and `idempotentHint`, answering `{ server: { name, version }, release, commit, builtAt, startedAt }`
  and, with a provider, `changelog` (a failing provider gives `changelog: null` and logs the error class, as the route
  does). A failing `buildInfo` lets the error reach the SDK, which answers the call as a tool error.
- `createMcpServerFactory({ serverInfoTool })`: registers it after the app's tools, on the measured and the served
  server alike, for every access level, through the strict wrapper when that is on.
- Tests: the tool is listed only with the option, for read and write tokens; the answer carries the served version
  (measured and fixed) and the build info; the changelog and its failure; the version changes when the option is
  turned on; strict input refuses an unknown field.

## Phase 2: docs

`modules/mcp-access/README.md` (the tool, wiring with `readBuildInfo`), `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- The app passes `readBuildInfo` instead of mcp-access importing ops: `/server` stays loadable without the optional
  peer, and the answer is the route's by construction when the app passes the same function and changelog provider.
- Name and version come from the factory, so the answer is exactly what `initialize` served.
- Registered for read and write tokens: it reads no user data.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: tool and factory option
- [x] Phase 2: docs
- [x] Implementation review: approved
