# Plan review: agent-ready-factory-zod-lifetimes

- Date: 2026-10-09
- Inputs: change.md, plan.md, issue #316, `modules/agent-ready/src` (options, settings, next, server, webmcp),
  `modules/mcp-access/src/{options,contract}.ts`, `src/server/endpoint.ts`, issue #315.
- Verdict: **approve** with two adjustments applied to the plan.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | A global registry (the issue's second option) depends on module state being shared by every route bundle, which Next does not promise; the adopter needed `globalThis` for it. | Decision 2 takes the route-level option. |
| 2 | Warning | Calling an mcp-access factory with `canWrite: true` while mcp-access has `allowWrites: false` would list write tools no token can call. | Decision 1 reads `allowWrites` from the config. |
| 3 | Check | Backward compatibility: `() => server` is assignable to a one-parameter function type; plain route re-exports keep their names and paths; JSON Schema passes through `toWebMcpInputSchema`. | No change. |
| 4 | Check | #315 keeps `McpServerFactory(identity)` and adds `serveMcpStdio({ createServer })` on the same contract; the identity shape is mirrored structurally, no import. | No change. |
| 5 | Check | `z.toJSONSchema` in `/webmcp` keeps the entry browser-safe (zod has no Node imports). | No change. |
