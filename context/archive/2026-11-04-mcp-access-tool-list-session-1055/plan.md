---
change_id: mcp-access-tool-list-session-1055
status: archived
---

# Plan: sessions tied to the tool list version (issue #1055)

Input: change.md, research.md. Complexity: medium (one new server file, endpoint wiring, factory, testing helper, docs).

## Phase 1: sessions in the endpoint

Files: `modules/mcp-access/src/server/tool-list-session.ts` (new), `src/server/endpoint.ts`,
`src/server/server-factory.ts`, `src/server/index.ts`, `tests/tool-list-session-1055.test.ts` (new).

1. `tool-list-session.ts`: `createToolListSessionId(version)`, `readToolListSessionVersion(sessionId)` (null when
   malformed), `isInitializeRequest(request)` (POST, no session id, JSON body within the limit, `method:
   "initialize"`), `rewriteInitializeAnswer(response, sessionId | null)` (sets `tools.listChanged: false`, adds the
   header; JSON or SSE body kept in its format; non-200 answers untouched).
2. `VersionedMcpServerFactory` = `McpServerFactory` with `toolListVersion(identity)`; `createMcpServerFactory`
   returns one; `McpEndpointOptions.toolListVersion` for hand-written factories.
3. Endpoint, after authentication: with a version reader and a session id, compare its version with the current one
   and answer 404 (JSON-RPC error `-32001 Session not found`, `no-store`) when they differ; an `initialize` answer is
   rewritten with a new session id (or only `listChanged: false` without a reader).
4. Tests: initialize issues a session id with the identity's version; same version keeps the session; changed tools
   answer 404; changed access level answers 404; malformed id answers 404; no session id is served as today;
   `listChanged` is false in JSON and SSE answers; hand-written factory without a reader gets no session id;
   endpoint option reader works.

## Phase 2: testing helper and docs

Files: `src/testing/catalog.ts` (or a new `src/testing/sessions.ts`), `src/testing/index.ts`,
`modules/mcp-access/README.md`, `modules/mcp-access/CHANGELOG.md`.

1. `expectToolListSessionRenewed(before, after)`: throws unless every access level whose measured list changed
   renews a session opened under `before`, and an unchanged one keeps it.
2. README section next to the tool list version; CHANGELOG `Unreleased` entry.

## Progress

- [x] Phase 1: sessions in the endpoint (f40a10f, 17 new tests; helper in `src/testing/sessions.ts`)
- [x] Phase 2: testing helper and docs (e7b6279)
