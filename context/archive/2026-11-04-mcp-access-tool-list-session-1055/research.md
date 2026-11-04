---
change_id: mcp-access-tool-list-session-1055
---

# Research: sessions tied to the tool list version

## Findings

- `src/server/endpoint.ts`: `createMcpEndpoint` wraps `createMcpHandler(factory, { responseMode: "json" })` from
  `@modelcontextprotocol/server` 2.3.0. After rate limit and Bearer verification it calls `handler.fetch(request,
  { authInfo })`; the factory builds a fresh server per request from `readIdentity(authInfo)`.
- Probe against the SDK (legacy 2025-06-18 traffic, stateless fallback): `initialize` answers 200 as one SSE `message`
  event when the client accepts `text/event-stream` (the `json` response mode governs only the modern era), with
  `capabilities.tools.listChanged: true` (set by `McpServer.registerTool`) and no `mcp-session-id` header. A request
  that carries an arbitrary `mcp-session-id` is served normally (the stateless fallback ignores it). GET and DELETE
  answer 405. So the session check has to live in the endpoint wrapper, and the SDK needs no change.
- `src/server/server-factory.ts`: `createMcpServerFactory` measures the version once per access level and caches the
  promise (`measure(identity)`); `options.version` overrides it. The same reader can be exposed on the factory.
- `src/testing/catalog.ts`: `measureServedToolLists(createServer)` uses fixed `READER` / `WRITER` identities; a session
  helper can reuse them.
- Streamable HTTP (2025-06-18, "Session Management"): the server MAY assign a session id at initialization in the
  `Mcp-Session-Id` header of the `InitializeResult` response (visible ASCII); the client MUST send it on every later
  request; a server that has ended the session answers 404, and the client MUST start a new session with a fresh
  `InitializeRequest`.

## Risks

- A client that ignores 404 and keeps the session id would loop; the spec requires re-initialization, and a client
  without session support never sends the header, so it is unaffected.
- The access level changes the version too (writes switch, token scope): such a session is renewed as well, which is
  the right outcome (the client sees the other tool list).
- Reading the body to detect `initialize` must not bypass the SDK's 1 MiB limit: read only POSTs without a session id,
  through a clone, and skip a body over the limit (the SDK answers 413 on it).
