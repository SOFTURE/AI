---
change_id: mcp-access-adopter-helpers
reviewed: 2026-10-09
verdict: approved with fixes applied
---

# Plan review: mcp-access-adopter-helpers

Checked plan.md against change.md, issue #315, the package sources it names and the MCP SDK 2.3 typings.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical | The issue proposes a `beforeIssue` option; as a module option it would put the app's billing code into `softure.config.ts`, which the proxy and every script load (#316 reports exactly that for agent-ready). | Accepted: decision 6 takes the hook as an argument of `issueToken` in `/next`; nothing enters the options. |
| 2 | Warning | `withToolErrors` passing a thrown error's text would repeat the adopting app's leak (SQL with parameters). | Accepted: only a `PublicError` message or a hint reaches the assistant; the log gets `errorLogLabel`. |
| 3 | Warning | The stdio entry picking "the first account" would serve another person's data on a shared database. | Accepted: only when exactly one account exists; otherwise the env id is required and checked against `auth.users`. |
| 4 | Warning | Stdio write access ignoring the config's `allowWrites` would bypass the app's switch. | Accepted: `canWrite` needs both. |
| 5 | Suggestion | A `server-only` shim via `--conditions=react-server` would also switch React to its server build. | Accepted: a resolve hook for `server-only` alone. |
| 6 | Check | `McpServerFactory(identity)` is unchanged, so #316 can adopt it without waiting for this change. | No change. |

No open Critical findings.
