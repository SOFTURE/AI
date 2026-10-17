---
change_id: mcp-access-challenge-scopes-553
reviewed: 2026-10-17
verdict: approved
---

# Implementation review: mcp-access-challenge-scopes-553

Reviewed: the branch diff against plan.md, change.md and issue #553.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | `authenticate()` names `mcp:read mcp:write` while `allowWrites` is on, `mcp:read` otherwise, for the OAuth and the Bearer-only challenge; tested both ways. | No change. |
| 2 | Check | A missing or blank `scope` reads as the default scope; an explicit `mcp:read` stays read-only. The grant still needs `allowWrites` and the tick (decision code unchanged). | No change. |
| 3 | Check | The exported `isWriteScopeRequested` keeps its contract; the default lives in a private helper next to it. | No change. |
| 4 | Check | No other code or e2e test asserts the old challenge scope. | No change. |
| 5 | Check | CHANGELOG `## Unreleased` with the migration, README updated, no version bump (batched releases). | No change. |
