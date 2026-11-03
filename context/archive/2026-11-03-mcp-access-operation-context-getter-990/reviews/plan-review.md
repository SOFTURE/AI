---
change_id: mcp-access-operation-context-getter-990
reviewed: 2026-11-03
verdict: approved
---

# Plan review: mcp-access-operation-context-getter-990

Checked plan.md against change.md, research.md, issue #990 and `src/jobs/operations.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | Resolving hints before `withToolErrors` would need the context outside the error boundary, so a failing getter would throw out of the handler. | The work resolves the context and answers through `answerValue` with that config's hints, inside `withToolErrors`. |
| 2 | Minor | Passing both `ctx` and `getContext` would be ambiguous. | A discriminated union with `never` on the other key; a type test is not needed beyond typecheck of the tests. |
| 3 | Minor | The description with a getter cannot follow the app's dictionary without a config. | Optional `config`; English default documented. |
| 4 | Minor | `agent-ready` pins `@softure-ai/mcp-access` in devDependencies. | No version bump in this change; the release thread checks the range. |

Verdict: approved.
