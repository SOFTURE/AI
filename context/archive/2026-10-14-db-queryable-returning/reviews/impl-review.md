---
change_id: db-queryable-returning
reviewed: 2026-10-14
verdict: approved
---

# Implementation review: db-queryable-returning

Checked the diff (`a76881c`) against plan.md and issue #475.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Type tests cover the issue's reproduction (delete) and the update case; they fail without the change. | No change. |
| 2 | Check | Plan-review findings 1 and 2 are in `types.test.ts` (PGlite transaction, `Database` to `Queryable`). | No change. |
| 3 | Check | Whole-tree typecheck is green with no module edits: every `ctx.db` caller and every `execute().rows` reader compiles. | No change. |
| 4 | Check | No runtime code changed; `QueryableResult` and `QueryableResultHKT` are exported and documented (README, CHANGELOG `## Unreleased`). | No change. |
| 5 | Warning | A result typed `{ rows }` only would drop `rowCount`, `command` and `fields`, which the former union exposed: a breaking change for apps. | Fixed: `QueryableResult` keeps the four shared fields, with a type test; db ships as 0.1.10. |

No Critical findings.
