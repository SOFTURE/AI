---
change_id: deploy-release-checks
reviewed: 2026-10-12
verdict: approved
---

# Plan review: deploy-release-checks

Checked plan.md against change.md, research.md, issue #406 and the existing deploy workflows.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `build` with `needs: [static, unit]` is skipped when either is skipped unless its `if:` starts with `!cancelled()`; and then it must still refuse a failed `prepare`. Spell all three results out. | Taken into Phase 1. |
| 2 | Warning | The tag guard must check the commit the other jobs check out: resolve the SHA once in `prepare` and pass it as an output, never re-resolve the tag later (a moved tag). | Taken into Phase 1. |
| 3 | Warning | `ci-workflows.test.ts` asks for a numeric `timeout-minutes` on every reusable job, so an input cannot set it: fixed 5 (prepare), 30 (static, build), 60 (a unit shard; more shards when one runs longer). | Taken into Phase 1. |
| 4 | Warning | The new examples must join actionlint's explicit list in `ci.yml`, as the others are outside `.github/workflows/`. | Taken into Phase 2. |
| 5 | Check | The `pull_request` `labeled` trigger re-runs `static`; acceptable, it is cheap and concurrency cancels the older run. | No change. |

No Critical findings.
