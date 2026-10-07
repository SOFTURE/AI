# Plan review: release-pending-changes

Date: 2026-10-07 · Verdict: approved

- Scope check: the eleven other packages show an empty diff against their tags (CHANGELOG excluded), so they stay.
- `release:version` refuses an empty `## Unreleased` and a bump a dependent's range would refuse; all four are
  0.1.x patch bumps inside `^0.1.x` ranges.
- Local tags must not be pushed (the session cannot push tags); `auto-release` creates them from `master`.
