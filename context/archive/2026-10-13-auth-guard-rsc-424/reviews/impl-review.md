---
change_id: auth-guard-rsc-424
reviewed: 2026-10-13
verdict: approved
---

# Implementation review: auth-guard-rsc-424

Reviewed: the branch diff against plan.md, change.md and issue #424.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. The issue's reproduction now yields `next=%2Fhistory%3Fview%3Dyears` (tested). | No change. |
| 2 | Check | Plan review 1 and 2: a bare `_rsc` and an undecodable name (`%E0`) are tested; the helper never throws. | No change. |
| 3 | Check | Both redirect forms share `getReturnPath`; the `relative` form is tested. | No change. |
| 4 | Warning | Empty query segments (`?a=1&&b=2`) are dropped as well; the page reads the same parameters. | Accepted. |
| 5 | Check | Docs: README route guard paragraph, CHANGELOG `## Unreleased` (no version bump, batched releases). | No change. |

Gates: see plan.md Progress.
