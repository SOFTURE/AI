---
change_id: deploy-verify-header-starts-with-441
reviewed: 2026-10-13
verdict: approved
---

# Implementation review: deploy-verify-header-starts-with-441

Checked the diff (`810a20a`, `6a2941d`) against plan.md, change.md and issue #441.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | A plain string takes the old branch: same `includes`, same `has` and `expected` details; every existing verify test passes untouched. | No change. |
| 2 | Check | An unknown key, an empty object and an empty `startsWith` are refused by the strict object; the issue path names the header. | No change. |
| 3 | Check | The failing detail reads `expected to start with`, so an anchored miss is told apart from a substring miss (plan review #2). | No change. |
| 4 | Note | Plan review #1 promised a merge test; `mergeHeaderChecks` is a whole-entry spread with no knowledge of the item shape, so no test was added for it. | Recorded here. |
| 5 | Check | `schema/deploy.schema.json` was regenerated with `npm run schema`; `tests/schema.test.ts` compares it with the zod schema. | No change. |

Gates: `npm run typecheck`, `npm run lint` green in the pre-commit hook; the deploy tests (680 passed, 18 skipped)
pass; the full `npm test` runs in pre-push.
