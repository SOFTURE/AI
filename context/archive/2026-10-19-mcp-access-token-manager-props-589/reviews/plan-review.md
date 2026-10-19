---
change_id: mcp-access-token-manager-props-589
reviewed: 2026-10-19
verdict: approved
---

# Plan review: mcp-access-token-manager-props-589

Checked plan.md against change.md, research.md, issue #589 and `pages.tsx`, `token-manager.tsx`, `card.tsx`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | One code path: `McpAccessPage` uses the exported builder, so the app's page and the package's page cannot drift. | No change. |
| 2 | Major | The builder must not skip authorization: it takes a `userId` and lists only that user's tokens and grants; the app passes its signed-in user's id, as with every server function. | A test pins that another user's tokens are not returned; README says to pass the session's user id. |
| 3 | Check | Proposal 2 needs an `h1` in `Card`, which `@softure-ai/ui` does not offer; recorded under Decisions (auto). | No change. |
| 4 | Minor | `grants` must be absent, not `undefined`, while OAuth is off (`exactOptionalPropertyTypes`, and `TokenManager` checks the key). | Test asserts the key is absent. |
| 5 | Check | Additive export, no breaking change; the private helpers move file without behaviour change (existing page behaviour covered by the new tests on the same builder). | No change. |

No Critical findings.
