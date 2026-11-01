---
change_id: mcp-access-strict-nullable-919
reviewed: 2026-11-01
verdict: approved
---

# Implementation review: mcp-access-strict-nullable-919

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | WARNING | The `optin` override must hold for the SDK's compiled object parser too, not only the interpreted one. | Both read the same `_zod.optin`; the parse cases in `strict-tool-input-919.test.ts` run through `safeParse` and the SDK's `tools/call`. |
| F2 | SUGGESTION | A `z.coerce` scalar inside a wrapper must not get a text step. | `findTextReader` reads the chain's bottom; tested ("leaves a coercing scalar inside a wrapper as it is"). |
| F3 | SUGGESTION | The empty-schema listing changes the tool list version an app measures. | Recorded in the changelog entry. |

Gates: typecheck, ESLint on the changed files, the language gate, `modules/mcp-access` and `tests/repo` tests (915 passed) green.
