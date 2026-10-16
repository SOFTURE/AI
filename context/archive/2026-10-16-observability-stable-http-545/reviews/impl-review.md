---
change_id: observability-stable-http-545
reviewed: 2026-10-16
verdict: approved
---

# Implementation review: observability-stable-http-545

Reviewed: the branch diff against plan.md, change.md and issue #545.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The exported span has both keys of each pair and `url.path` without the query (exact-value test). | No change. |
| 2 | Check | A stable key already set is kept; CLIENT spans are untouched. | No change. |
| 3 | Check | On by default in `/next`, off in `/node`, an explicit `false` wins; each is tested against a receiver. | No change. |
| 4 | Check | README has the mapping and the legacy query key; CHANGELOG `## Unreleased`, no version bump. | No change. |
