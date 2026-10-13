---
change_id: ui-locale-provider-reach-435
reviewed: 2026-10-13
verdict: approved
---

# Plan review: ui-locale-provider-reach-435

Checked plan.md against change.md, research.md, issue #435 and the files it touches.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The issue asks for the resolution in every client component; the plan changes charts only. Research shows the module forms already reach the provider through the ui fields they render, so wrapping `locale` again would be dead code. | Accepted; recorded under Decisions (auto) and in the PR body so the issue author sees why. |
| 2 | Warning | Raising the charts peer floor to 0.1.7 could break an app pinned to ui 0.1.6. | Accepted: 0.1.6 predates every charts release that ships `ChartCursor` with copy props from ui-era messages; CHANGELOG names the new floor. |
| 3 | Check | The `"use client"` boundary is kept: `useUiLocale` is called only inside files that already start with `"use client"`. | No change. |
| 4 | Check | Billing edits stay in README and CHANGELOG, away from the #426 and #428 diffs. | No change. |

No Critical findings.
