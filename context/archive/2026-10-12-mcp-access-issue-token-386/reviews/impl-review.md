# Implementation review: mcp-access-issue-token-386

Reviewed: the branch diff against plan.md, change.md and issue #386.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: the gate's text refusal is `refuseIssue(code, message)` instead of `err({ code, message })`, because core's `err` takes only a namespaced code. Recorded under Decisions (auto); the result is still an `Err` for code that checks `ok`. | No change. |
| 2 | Check | `PublicError` is detected through core's `getPublicMessage` (brand check), so a gate built against another copy of core works; it is not logged, every other thrown error still is and maps to a safe code (tested). | No change. |
| 3 | Check | `clientServerName` reuses `SERVER_NAME_PATTERN`, so the name stays a shell word and JSON key; invalid names are refused at config time (tested). `resource_name` in OAuth metadata stays on `serverName`. | No change. |
| 4 | Check | `message` lives only on the issue form state; revoke states are unchanged. A blank text falls back to the code's copy. | No change. |
| 5 | Check | Defaults unchanged: the #315 tests pass untouched; the `TokenManager` fixture gains `expiresAt` only because the type requires it. | No change. |
| 6 | Check | Docs: README option row, gate section with `refuseIssue` and `PublicError`, `expiresAt`; CHANGELOG `## Unreleased` (no version bump). | No change. |

Gates: see plan.md Progress.
