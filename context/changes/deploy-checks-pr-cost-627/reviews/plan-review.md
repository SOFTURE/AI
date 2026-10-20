---
change_id: deploy-checks-pr-cost-627
reviewed: 2026-10-20
verdict: approved
---

# Plan review: deploy-checks-pr-cost-627

Checked plan.md against change.md, research.md, issue #627 and the workflow.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | With `prepare` skipped, `static`/`unit` are skipped too unless their `if` uses a status function; `always()` would also run them after a cancel. | Planned: `!cancelled() && needs.prepare.result != 'failure'`. |
| 2 | Major | Without `prepare` nothing would check the inputs (an empty `static-command` would pass silently). | Planned: the same step, aliased, first in `static` and `unit`. |
| 3 | Minor | `unit` with more than one shard needs the list `prepare` builds. | Planned: `prepare` runs then; `[1]` fallback otherwise. |
| 4 | Minor | A cache path is joined by the action relative to the workspace; `..` or an absolute path would reach outside the checkout. | Planned: the input check refuses both. |
| 5 | Check | `github.sha` on a pull request is the merge commit, the same commit `prepare` reported before. | No change. |
| 6 | Check | The cache key carries the commit, so a later run never overwrites an entry and each run saves at most once. | No change. |

No Critical findings.
