---
change_id: core-request-json-598
reviewed: 2026-10-19
verdict: approved
---

# Plan review: core-request-json-598

Checked plan.md against change.md, research.md, issue #598 and `result.ts`, `safe-error.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | A timeout can fire while the body is read, after the status was mapped; an uncaught rejection would escape as an exception. | The body is read with `text()` inside its own try; a rejection there is unreachable. Covered by a test. |
| 2 | Major | `response.json()` would conflate a body-read failure with invalid JSON. | Read `text()`, then `JSON.parse` in a separate try: parse failure is unexpected_answer. |
| 3 | Minor | The caller's `Accept` in any letter case must win over the default. | Build a `Headers` from the caller's headers and set `Accept` only when `has("accept")` is false. |
| 4 | Minor | Schema failure must not leak the zod issue text (it can quote values). | Only the code and the status are returned. |
| 5 | Check | Overloads keep `unknown` without a schema, so callers must narrow at the boundary (AGENTS.md TypeScript rule). | No change. |
| 6 | Check | Parallel #599 edits core's `index.ts`, README and CHANGELOG; conflicts are resolved by merging master before the merge. | No change. |

No Critical findings.
