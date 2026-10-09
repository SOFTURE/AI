---
change_id: agent-ready-factory-zod-lifetimes
status: archived
---

# Plan: MCP factory, zod WebMCP schemas, lifetimes from mcp-access (issue #316)

Input: change.md (research and framing skipped, reasons there). Complexity: medium (three phases plus docs).

## Today (master `5b8b4ac`)

- `options.ts`: `mcp.server` is required, typed `McpServerFactory = () => unknown`.
- `next/documents.ts` `describeServer(context)` passes `context.options.mcp.server` to `readServerDescription`; it is
  used by `serveMcpServerCard`, `serveA2aAgentCard`, and through `renderSkills`/`renderSkill` (the generated MCP
  skill) by `serveAgentSkillsIndex`, `serveAgentSkill` and `serveAiCatalog`.
- `server/introspect.ts` `readServerDescription(factory)` calls `factory()` inside `createMcpHandler`.
- mcp-access: `McpServerFactory = (identity: McpServerIdentity) => McpServer | Server | Promise<…>`,
  `McpServerIdentity = { userId, canWrite, tokenId }`; options `allowWrites` and `oauth.{enabled,
  accessTokenLifetimeMinutes, refreshTokenLifetimeDays, authorizationCodeLifetimeMinutes}` (defaults 60, 90, 10).
- `auth-md.ts` reads `options.oauth?.lifetimes` (`authorizationCodeMinutes`, `accessTokenMinutes`, `refreshTokenDays`).
- `webmcp/index.ts`: `inputSchema: Record<string, unknown>`, passed as is to `registerTool` and into the boot script.

## Decisions

1. **One factory contract.** agent-ready's `McpServerFactory` becomes `(identity: McpDiscoveryIdentity) => unknown`
   with `McpDiscoveryIdentity = { userId, canWrite, tokenId }`, the shape of mcp-access's `McpServerIdentity`, so
   mcp-access's `createServer` is assignable as is, and an old `() => server` still is. Discovery calls it with
   `{ userId: "00000000-0000-0000-0000-000000000000", canWrite, tokenId: "agent-ready-discovery" }`
   (`createDiscoveryIdentity`). `canWrite` is mcp-access's `allowWrites` when that module is configured (the card then
   lists what a real token can reach), else `true`. No tool is called, so the nil user reads nothing.
2. **Factory out of the config.** `createAgentReadyRoutes({ createServer })` in `/next` returns every handler, the
   five that introspect bound to `createServer`. The plain exports stay and use `mcp.server` from the config, now
   optional. Without either, a route that needs the server answers 500 and logs
   `no MCP server factory: pass createServer to createAgentReadyRoutes() (or set mcp.server)`; routes that do not need
   it (API catalog, OpenAPI, auth.md, JWKS, signature directory, an app skill) keep working. A route-level option
   over a global registry: no module state shared across route bundles, and the factory module is imported only by
   the route files.
3. **mcp-access settings by module id.** `readMcpAccessSettings(config)` reads `getModule(config, "mcp-access")` and
   narrows its options with a loose zod schema (`allowWrites`, `oauth.*`); an unknown shape answers null (no
   mcp-access to align with), never throws.
4. **Lifetimes.** `resolveDocumentContext` fills `options.oauth.lifetimes` from mcp-access when the app configured
   `oauth` without `lifetimes` and mcp-access has `oauth.enabled`. Explicit `oauth.lifetimes` wins.
5. **zod in WebMCP.** `WebMcpInputSchema = Readonly<Record<string, unknown>> | z.ZodType`; `toWebMcpInputSchema(schema)`
   converts a zod schema (detected by its `_zod` member) with `z.toJSONSchema(schema, { io: "input" })` minus
   `$schema`, and returns JSON Schema unchanged. `registerWebMcpTool` and `buildWebMcpBootScript` convert before use;
   the browser receives `RegisteredWebMcpTool` (JSON Schema only). zod is already a dependency.
6. **Version.** 0.1.3 (0.1.2 is on npm), shared with #304 (PR #331).

## Phase 1: factory contract and routes (TDD)

Files: `src/options.ts`, `src/settings.ts`, `src/server/introspect.ts`, `src/next/documents.ts`, `src/next/routes.ts`,
`src/next/index.ts`, `src/index.ts`, `tests/factory.test.ts`, `tests/module.test.ts`.

Tests first (red on master): config without `mcp.server` is accepted; `createAgentReadyRoutes({ createServer })`
serves the server card, A2A card, skills index, MCP skill and AI catalog from the route factory; the factory receives
the discovery identity, `canWrite` follows mcp-access `allowWrites` (false → write tool absent); an mcp-access
`McpServerFactory` typechecks as the route option; without any factory those routes answer 500 with the log line and
the API catalog still answers 200.

## Phase 2: lifetimes from mcp-access (TDD)

Files: `src/settings.ts`, `tests/oauth.test.ts`. Tests: with `mcpAccess` (OAuth on, custom lifetimes 5 / 30 / 7) and
agent-ready `oauth` without lifetimes, `/auth.md` states them; explicit `oauth.lifetimes` wins; mcp-access with OAuth
off states none.

## Phase 3: zod WebMCP schemas (TDD)

Files: `src/webmcp/index.ts`, `tests/webmcp.test.ts`. Tests: `toWebMcpInputSchema` of a zod object equals the
hand-written JSON Schema; JSON Schema passes through; `registerWebMcpTool` and the boot script hand the browser JSON
Schema.

## Phase 4: docs and version

README (options table, OAuth paragraph, mounting with `createAgentReadyRoutes`, WebMCP), CHANGELOG `0.1.3`,
version 0.1.3 in `package.json`, `module.json`, `src/index.ts`, `package-lock.json`.

## Progress

- [x] Phase 1: factory contract and routes
- [x] Phase 2: lifetimes from mcp-access
- [x] Phase 3: zod WebMCP schemas
- [x] Phase 4: docs and version

Deviation: decision 5 uses the Standard JSON Schema interface instead of `z.toJSONSchema` (reviews/impl-review.md #1).
