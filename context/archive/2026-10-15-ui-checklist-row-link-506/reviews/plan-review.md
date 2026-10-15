---
change_id: ui-checklist-row-link-506
reviewed: 2026-10-15
verdict: approved
---

# Plan review: ui-checklist-row-link-506

Checked plan.md against change.md, research.md, issue #506 and `checklist.tsx`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Under `rowLink` the label would get the `link` slot's underline as well as the row's focus ring. | Taken: the label keeps the `label` look inside a row link; `link` slot only without `rowLink`. |
| 2 | Warning | A block link inside a flex `<li>` must keep the row layout, or the marker drops above the label. | Taken: the `row` slot carries the flex row defaults; the test checks the slot class. |
| 3 | Check | A trailing chevron must not join the link name; `ChevronRightIcon` is already `aria-hidden`. | No change; README says decorative trailing content should be `aria-hidden`. |
| 4 | Check | Defaults leave today's markup unchanged; the existing #407 tests stay as they are. | No change. |

No Critical findings.
