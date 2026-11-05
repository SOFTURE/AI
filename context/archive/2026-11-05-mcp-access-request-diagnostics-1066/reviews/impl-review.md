---
change_id: mcp-access-request-diagnostics-1066
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md and #1066.

- Acceptance: `diagnostics` on `createMcpEndpoint` (and `createMcpRoute`, which passes options through); the test
  asserts the full entry for `initialize`, `tools/list` in a current session, a stale session (with the version it
  carries), an id never issued, no session, a `tools/call` by name, and a 401; it checks that no token, argument
  value, session id or user id appears in any entry. README states what hosted clients do, with links to the reports.
- Default path: with the option off, `serve` gets `null` and every trace write is skipped; no extra body read. The
  1055 suite passes unchanged.
- Safety: the summary keeps only method, tool name, `clientInfo` and protocol version; client text is cut to 128
  characters and control characters replaced, so a client cannot forge log lines. A throwing sink is logged and the
  answer still goes out (tested).
- Known limit: a request without a session that is not `initialize` reports `toolListVersion: null`, since the
  endpoint does not read the version for it; documented in the README entry list as "served" version only.

Verdict: approved.
