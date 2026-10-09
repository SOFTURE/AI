---
change_id: mcp-access-adopter-helpers
reviewed: 2026-10-09
verdict: approved with fixes applied
---

# Implementation review: mcp-access-adopter-helpers

Checked the diff against plan.md and change.md, read the MCP SDK's `serveStdio` source for transport ownership, and
ran the gates.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical | `serveStdio` replaces the transport's `onclose`, so a handler set before the call never ran: with the default stdio transport the open database pool would keep the process alive after the client closed stdin. | Fixed: the handler is wrapped after `serveStdio` installs its own, and the default transport is created by the entry; a test closes the client side and waits for the database to close. |
| 2 | Warning | `"sideEffects": false` would let a bundler drop `import "@softure-ai/mcp-access/stdio/register"`. | Fixed: the register module is listed in `sideEffects`. |
| 3 | Check | `withToolErrors` and `actionTool`: a Drizzle-shaped failure reaches neither the answer nor the log (test asserts the email in the parameters is absent from both). | No change. |
| 4 | Check | `issueTokenAction` delegates to `issueToken` without a gate; the existing endpoint, token page and OAuth tests pass unchanged. | No change. |
| 5 | Suggestion | `softure-mcp prune` reports a failure by error kind only, since a driver message can carry the database address. | Accepted as written. |
| 6 | Check | The example app's tools use `toolResult` / `withToolErrors`; a failure now answers the error code as text instead of `{"error": code}`. Its e2e only checks `isError`. | No change. |

Gates: `npm run typecheck`, `npm run lint`, `npm run build` green; `vitest run modules/mcp-access tests/repo
examples/next-app` green; full `npm test` runs in the pre-push hook.
