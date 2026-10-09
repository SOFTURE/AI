---
change_id: ui-amount-thin-space
reviewed: 2026-10-09
verdict: approved
---

# Plan review: ui-amount-thin-space

Checked plan.md against change.md, issue #303, `amount.ts` and `tests/amount.test.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | `SPACES` feeds both `AMOUNT_PATTERN` and `GROUP_SEPARATOR`, so one edit cannot leave an accepted separator unstripped (which would make `Number(whole)` `NaN`). | No change. |
| 2 | Check | The strict rule holds: the class only sits between `\d{1,3}` and `\d{3}` groups; the plan's refusal cases pin it. | No change. |
| 3 | Suggestion | Other typographic spaces (U+2007, U+200A) could be added in the same edit. | No change: not reported, and decision 2 keeps the class to what is seen in practice. |

No Critical findings. Research and framing skips are justified in change.md.
