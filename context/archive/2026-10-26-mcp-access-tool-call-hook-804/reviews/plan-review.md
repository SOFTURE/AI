---
change_id: mcp-access-tool-call-hook-804
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, `tools.ts`, `action-tool.ts`, `endpoint.ts`, `stdio/serve.ts` and
`tests/adoption-gaps-315.test.ts`.

- Scope: covers every ask of the issue (hook with tool, token, client name, argument names, outcome with code,
  start and duration; failing hook logged and ignored; the client-name helper). Only the `mcp-access` package.
- Compatibility: all new options are optional; `actionTool`'s switch from `toolError(describeCode(...))` to
  `{ ok: false, error }` yields the identical answer through `answerValue`; the existing tests in
  adoption-gaps-315 pin that.
- Safety: argument values never enter the record; the stdio token id is handled without a failing uuid query.
- Tests: each outcome kind, the hook's failure modes and the helper's null cases are covered.

Verdict: approved, no changes.
