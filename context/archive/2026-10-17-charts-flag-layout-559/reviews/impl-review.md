---
change_id: charts-flag-layout-559
reviewed: 2026-10-17
verdict: approved
---

# Implementation review: charts-flag-layout-559

Checked the diff against plan.md, change.md and issue #559's acceptance.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance 1: rows are deterministic (sort by start, end, input index) and a generated 60-flag set asserts no two shown flags in one row are closer than `gap`. | No change. |
| 2 | Check | Acceptance 2: flags beyond `maxRows` come back `hidden: true` with `row: null` and are counted; `LineChart` draws them as one "+N" chip, never on top of another row. | No change. |
| 3 | Check | Additive: `ChartFlag` without `row`/`title` and `LineChart` without `flagStack` emit the same markup (asserted against the exact string). | No change. |
| 4 | Minor | The "+N" chip's `title` is a pointer tooltip only; screen readers read "+N". The flags are not in the data table today either, so nothing is lost against 0.3.0. | No change; noted for a later accessibility pass. |
| 5 | Check | `--sft-chart-flag-row` is set inline by the component, like `--sft-chart-event-lane`, and is registered as a local property in the token guard; no token rule was loosened. | No change. |
| 6 | Check | `translate` composes with the alignment `transform`; its percentage is the chip's own height, so `sm` chips stack tighter. | No change. |

No Critical or Major findings.
