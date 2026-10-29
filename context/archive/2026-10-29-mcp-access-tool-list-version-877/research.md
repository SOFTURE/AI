---
change_id: mcp-access-tool-list-version-877
---

# Research

- The module has no server factory of its own: apps pass `createServer(identity)` (`McpServerFactory`,
  `src/server/endpoint.ts`) and build `new McpServer({ name, version })` themselves (README, `tests/support.ts`).
  The endpoint, the stdio entry (`src/stdio/serve.ts`) and the catalog check (`src/testing/catalog.ts`) all take that
  factory, so a factory helper that returns an `McpServerFactory` plugs into all three unchanged.
- The catalog check already lists a server's tools the way the endpoint serves them: `createMcpHandler` in JSON mode and
  one stateless `tools/list` request. That is exactly "the tool list as the client reads it" (name, title,
  description, input and output JSON Schema, annotations, `_meta`), so the fingerprint reuses it instead of reading
  `McpServer` internals (`_registeredTools` is private).
- `@modelcontextprotocol/server` 2.3: `new McpServer(serverInfo: Implementation, options?: McpServerOptions)`.
  `serverInfo.version` is what `initialize` answers. Semver prerelease (`1.2.0-tools-ab12…`) compares as different;
  build metadata (`+…`) would be ignored by comparisons, hence the prerelease form the issue asks for.
- The tool list may depend on the identity only through `canWrite` (the endpoint's contract: write tools only when
  `canWrite`), which is why the issue measures per access level. Measuring once per level and caching it keeps the
  per-request cost at one registration.
- `node:crypto` `createHash("sha256")` is already used by the module (`tokens.ts`), so no new dependency.
