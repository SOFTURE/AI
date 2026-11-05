---
change_id: mcp-access-request-diagnostics-1066
status: active
---

# Plan: request diagnostics (issue #1066)

Input: change.md, research.md. Complexity: small (one new module, the endpoint, one test file, docs).

## Phase 1: diagnostics in the endpoint (TDD)

Files: `modules/mcp-access/src/server/request-diagnostics.ts` (new), `endpoint.ts`, `server/index.ts`,
`tests/request-diagnostics-1066.test.ts` (new).

- `McpRequestDiagnostic { httpMethod, method, tool, session, sessionVersion, toolListVersion, sessionIssued, status,
  client, protocolVersion }`; `session` is `none | current | stale | not_issued | unchecked`.
- `McpEndpointOptions.diagnostics?: boolean | ((entry) => void)`. `true` writes one `console.info` line
  `@softure-ai/mcp-access: mcp request {json}`; a function receives the entry (its own error is logged, the answer
  still goes out).
- The body summary (method, tool name, `clientInfo`, `protocolVersion`) is read from a clone only when diagnostics are
  on, bounded by `MAX_MCP_REQUEST_BYTES`; a batch is `method: "batch"`. Requests refused before serving (401, 429)
  get an entry with their status and no served version. Client-supplied strings are cut to 128 characters and stripped of
  control characters.
- Tests: `initialize` (client, protocol version, issued session, served version), `tools/list` in a current session,
  a request in a stale session (404, the stale version), one with no session, a `tools/call` with the tool name and
  no argument value, a 401 with no token in the entry, `true` writing one `console.info` line, off by default.

## Phase 2: docs

README "Sessions that follow the tool list" gets "Request diagnostics" and "What hosted clients do with a changed
tool list" (from research.md), CHANGELOG `## Unreleased`.

## Decisions (auto)

- Option 1 of research.md: an endpoint option, not a config key; an app switches it with its own env flag.
- The session id itself is not logged (it is a per-client correlation handle); its state and, when stale, the
  version it carries are enough to see renewal.
- No version bump: the coordinator releases.

## Progress

- [x] Phase 1: diagnostics in the endpoint
- [x] Phase 2: README and CHANGELOG
- [x] Implementation review: approved
