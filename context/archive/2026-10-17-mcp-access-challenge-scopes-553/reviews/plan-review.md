---
change_id: mcp-access-challenge-scopes-553
reviewed: 2026-10-17
verdict: approved
---

# Plan review: mcp-access-challenge-scopes-553

Checked plan.md against change.md, research.md, issue #553, `endpoint.ts` and `oauth-http.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Naming `mcp:write` in the challenge only makes clients ask; the grant still needs `allowWrites` and the tick (decision code unchanged). | No change. |
| 2 | Check | `allowWrites` is read per request, so the challenge follows a config change at once, like `canWrite`. | No change. |
| 3 | Minor | The Bearer-only challenge changes too; hand-issued token clients ignore the scope, so no behaviour changes for them. Test both shapes. | Covered in Phase 1. |
| 4 | Check | The default for a missing scope lives in `validateAuthorizationRequest`, keeping the exported `isWriteScopeRequested` contract. | No change. |

No Critical findings.
