---
change_id: mcp-access-request-diagnostics-1066
---

# Research

## Code (master e56019b)

- `modules/mcp-access/src/server/endpoint.ts`: `createMcpEndpoint` → rate limit → `authenticate` → `serveInSession`.
  `serveInSession` reads the session id header, classifies `initialize` with `isInitializeRequest` (a clone of the
  body), reads the tool list version, answers 404 through `createSessionRenewalResponse` for any session whose
  version differs, including ids the endpoint never issued (`readToolListSessionVersion` → `null`).
- `src/next/route.ts`: `createMcpRoute(options)` passes `McpEndpointOptions` through, so a new endpoint option is
  available to Next apps with no extra wiring. Only POST is exported; GET and DELETE answer 405 from Next.
- Logging today: `console.error` lines prefixed `@softure-ai/mcp-access:` for failures only; nothing for successes.
- Tests: `tests/tool-list-session-1055.test.ts` builds requests with `createMcpRequest` (`tests/support.ts`) and a
  versioned factory; the new test can reuse that shape.

## Evidence about hosted clients (public reports)

- anthropics/claude-ai-mcp#137 (claude.ai connector, closed in favour of #45): a server that added a tool still shows
  the old list after disconnect/reconnect, delete and re-add, restart and renaming the tool; a commenter saw the
  server re-initialize correctly while the client kept its cached list, and only a new conversation picked it up.
- anthropics/claude-ai-mcp#1182 (Claude Desktop, open): `notifications/tools/list_changed` on an open subscription
  is followed by no `tools/list`; a new conversation days later still shows removed tools; disconnect and reconnect
  in Settings → Connectors refreshes it.
- anthropics/claude-code#38324 (Claude mobile and desktop apps): updated `tools/list` never reflected, also in a new
  conversation; deleting and re-adding the connector is the only workaround.
- anthropics/claude-code#88172 (desktop, protocol 2026-07-28): new conversation and repeated `server/discover` do
  not refresh; relaunching the app or removing and re-adding the connector does.
- anthropics/claude-code#40025 (Claude Code, stdio): the cache is keyed by server name; renaming the server
  refreshes it.

Conclusion: the hosted clients keep a tool list cache on their side that is not reliably driven by anything the
server sends (version, session renewal, `list_changed`). What refreshes it differs by surface and over time: a new
conversation, disconnect and reconnect, removing and re-adding the connector, relaunching the app. The diagnostics
show which requests a given client sends, so an app can tell "never re-initializes / never re-lists / sends no
session" apart instead of guessing.

## Options

1. A `diagnostics` option: `true` logs one `console.info` line per request; a function receives the entry instead.
   Simple, testable, no config schema change, and an app can switch it with its own env flag.
2. A module config key in `mcpAccessOptionsSchema`: the endpoint would need the config at construction, it only gets
   it per request through `ctx`; more wiring for no gain.

Recommendation: option 1.
