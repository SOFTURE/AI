---
change_id: mcp-access-issue-token-386
reviewed: 2026-10-12
verdict: approved
---

# Plan review: mcp-access-issue-token-386

Checked plan.md against change.md, research.md, issue #386 and the source files.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `RevokeTokenFormState` shares the error shape; keep `message` on the issue state only, the revoke forms have no gate. | Taken into Phase 1. |
| 2 | Warning | `PublicError` must be checked with `isPublicError`, not `instanceof`, so a gate built against another copy of core is recognised. | Taken into Phase 1. |
| 3 | Check | `oauth-http.ts` `resource_name` stays on `serverName`: it is the server's identity, not the client's entry name. | No change. |
| 4 | Check | Defaults unchanged: the #315 tests stay as they are. | No change. |
