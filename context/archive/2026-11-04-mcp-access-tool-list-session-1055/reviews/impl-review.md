---
change_id: mcp-access-tool-list-session-1055
reviewed: 2026-11-04
verdict: approved
---

# Implementation review: mcp-access-tool-list-session-1055

Reviewed commits f40a10f and e7b6279 against plan.md and issue #1055.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | A failing version reader (a measurement that throws) would escape the endpoint as a 500 instead of the SDK's own error handling. | Caught: logged by error class, the request is served statelessly as before #1055; covered by a test. |
| 2 | Minor | Every POST without a session id is read once more from a clone to detect `initialize`. | Bounded by `MAX_MCP_REQUEST_BYTES` (header and length); the SDK reads the same body anyway. |
| 3 | Minor | The SDK answers 2025-era traffic as one SSE event and refuses a client that does not accept the stream (406), so the JSON branch of `rewriteInitializeAnswer` is defensive only. | Kept: small, and a future SDK that answers JSON keeps working; the 406 path is covered (passed through, no session id). |
| 4 | Minor | Option 2 of the issue (`list_changed` on an SSE answer) is not done. | Recorded under Decisions (auto) in change.md: the 404 already makes the client re-list, and `listChanged` is declared false. |
| 5 | Minor | DELETE with a stale session answers 404 instead of the SDK's 405. | Allowed by the spec (the session is gone either way). |

Gates: typecheck green; ESLint and the language gate green (pre-commit); mcp-access tests 497 of 497 green (17 new);
repository tests green. Verdict: approved.
