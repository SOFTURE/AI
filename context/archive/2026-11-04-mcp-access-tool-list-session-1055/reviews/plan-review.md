---
change_id: mcp-access-tool-list-session-1055
reviewed: 2026-11-04
verdict: approved
---

# Plan review: mcp-access-tool-list-session-1055

Checked plan.md against change.md, research.md, issue #1055 and `src/server/endpoint.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | The 404 check must run after authentication: the version depends on the identity's access level, and an unauthenticated request must keep getting the 401 challenge. | Step 3 runs after `authenticate`, with `readIdentity`. |
| 2 | Major | Parsing the body for `initialize` before the SDK could read an oversized body. | Only POSTs without a session id, through a clone, skipped above `MAX_MCP_REQUEST_BYTES` by `content-length` and by length. |
| 3 | Minor | The SDK answers `initialize` as SSE to clients that accept it, despite `responseMode: "json"`. | `rewriteInitializeAnswer` keeps the body's format; tests cover both. |
| 4 | Minor | `vi.fn` wrappers in tests drop the factory's `toolListVersion` property. | The endpoint option `toolListVersion` covers hand-written and wrapped factories. |
| 5 | Minor | The helper must not need a database: it works on factories only, through the same session functions the endpoint uses. | Helper uses `createToolListSessionId` / `readToolListSessionVersion` with the factory readers. |

Verdict: approved.
