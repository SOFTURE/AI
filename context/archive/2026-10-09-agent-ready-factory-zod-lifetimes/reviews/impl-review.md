# Implementation review: agent-ready-factory-zod-lifetimes

Reviewed: the branch diff against plan.md, change.md and issue #316.
Verdict: **approve** (one deviation from the plan, recorded below).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Plan decision 5 converted zod schemas with `z.toJSONSchema`, which adds an import to `/webmcp`; the architecture test keeps that browser entry free of every import. | Deviation: the conversion goes through the schema's own Standard JSON Schema interface (`~standard.jsonSchema.input({ target: "draft-2020-12" })`), typed by shape. zod 4 implements it, so no import and the same output; the input side drops `additionalProperties: false`, as the MCP SDK's listing does. |
| 2 | Check | Factory: `createAgentReadyRoutes({ createServer })` wins over `mcp.server`; the plain exports are the same builder without a factory; the setup error is thrown before the SDK handler, so its message reaches the log (test). An app skill and an unknown skill still build no server (existing test). | No change. |
| 3 | Check | Contract: an mcp-access `McpServerFactory` typechecks as `createServer` (`tests/factory.test.ts`), and a zero-argument factory still fits `mcp.server`. `canWrite` follows `allowWrites` (test with both values). | No change. |
| 4 | Check | Lifetimes: filled only when agent-ready has `oauth` without `lifetimes` and mcp-access has `oauth.enabled`; explicit lifetimes win; unknown mcp-access option shapes answer null instead of throwing. | No change. |
| 5 | Check | Every new test was red on master (11 failures before the change), green after; the existing suite passes unchanged except the `mcp.server` error text, which now names the identity argument. | No change. |
| 6 | Check | Docs: README (options table, OAuth lifetimes, mounting with `createAgentReadyRoutes`, WebMCP), CHANGELOG `0.1.3`, version 0.1.3 in `package.json`, `module.json`, `src/index.ts` and `package-lock.json`. | No change. |

Gates: `npm run typecheck`, `npm run lint`, `npm test` (pre-push), `npm run build`.
