---
change_id: agent-ready-factory-zod-lifetimes
title: "agent-ready: MCP server factory out of the config, zod WebMCP schemas, OAuth lifetimes from mcp-access (issue #316)"
status: archived
roadmap_item: null
issue: 316
branch: claude/project-thread-onx68m
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #316](https://github.com/SOFTURE/AI/issues/316), three gaps an adopting app hit with
`@softure-ai/agent-ready` 0.1.1:

1. **Server factory.** `mcp.server` lives in `softure.config.ts`, so a bundler that follows its dynamic `import()` pulls
   the MCP server and the database client into every script and proxy that reads the config. The app also bridges two
   factory contracts (mcp-access `McpServerFactory(identity)` vs agent-ready `() => server`) with a nil-UUID identity.
   After: the routes that introspect the server can be built with the factory
   (`createAgentReadyRoutes({ createServer })` from `/next`), so the config holds no server; and agent-ready calls the
   factory with an mcp-access-shaped discovery identity, so the app passes the same `createServer` it gives
   `createMcpRoute`. `mcp.server` in the config becomes optional and keeps working.
2. **WebMCP schemas.** `inputSchema` accepts a zod schema too, converted with `z.toJSONSchema` (input side), for
   `registerWebMcpTool` and `buildWebMcpBootScript`.
3. **OAuth lifetimes.** When `@softure-ai/mcp-access` is in the config with OAuth on, auth.md states its lifetimes;
   `oauth.lifetimes` stays as an override for another issuer.

A reviewer checks the new tests (`tests/factory.test.ts`, `tests/webmcp.test.ts`, `tests/oauth.test.ts`), the README
sections on options, mounting and WebMCP, and the CHANGELOG.

## Context

GitHub Issues mode, no roadmap item. agent-ready 0.1.2 (#311, core origins) is on npm, so this change ships as 0.1.3,
shared with #304 (PR #331, `nextHeaders` typing): the second to merge folds into the same CHANGELOG section.
#315 (mcp-access tool helpers, stdio entry) runs in parallel and keeps `McpServerFactory(identity)` as mcp-access's
contract; this change adopts it.

## Constraints

- No dependency on `@softure-ai/mcp-access` at runtime: its options are read from the config by module id and
  narrowed with a schema.
- The root entry stays loadable from `next.config.ts` and `proxy.ts`; `/webmcp` stays browser-only.
- Existing apps keep working: `mcp.server: () => server` in the config, plain route re-exports, hand-written JSON
  Schema, explicit `oauth.lifetimes`.
- English-only code and docs; neutral public wording.

## Process notes

- Research: skipped as a separate file. The issue names the three places; reading `options.ts`, `settings.ts`,
  `next/routes.ts`, `next/documents.ts`, `server/introspect.ts`, `auth-md.ts`, `webmcp/index.ts`, mcp-access's
  `options.ts`, `contract.ts` and `server/endpoint.ts` answered every unknown; findings are in plan.md.
- Framing: skipped. The issue states the problems and candidate fixes; choices are settled in plan.md.
