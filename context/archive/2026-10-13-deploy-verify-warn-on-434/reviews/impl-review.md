---
change_id: deploy-verify-warn-on-434
reviewed: 2026-10-13
verdict: approved
---

# Implementation review: deploy-verify-warn-on-434

Checked the diff (`eb8849e`, `bc97546`) against plan.md, change.md and issue #434.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | A route without `warnOn` takes the old path unchanged: `isWarnOnStatus` is false and every existing verify test passes untouched. | No change. |
| 2 | Check | The warn row is built per target, so one `forEach` entry answering 404 warns without changing its siblings' rows (plan review #1). | No change. |
| 3 | Check | A request error has no status and keeps the route's severity: an unreachable key directory still fails. | No change. |
| 4 | Check | `schema/deploy.schema.json` was regenerated with `npm run schema`; `tests/schema.test.ts` compares it with the zod schema. | No change. |
| 5 | Check | No other code enumerates route keys (dry run, templates), so nothing else needs `warnOn`. | No change. |
| 6 | Note | The issue's aside (a header check anchored at the start of the value) is not done here; filed as its own issue. | Recorded in change.md. |

Gates: `npm run typecheck`, `npm run lint` green in the pre-commit hook; the verify tests (9 files, 147 tests) pass;
the full `npm test` runs in pre-push.
