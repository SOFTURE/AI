---
change_id: theme-flat-paint-table-shot-784
verdict: approved
---

# Plan review

- Coverage: every rule of the issue has a slot or a declaration (header 12 px 500 muted, 44 px rows with a hairline,
  right-aligned `tabular` amounts, bold last column, muted empty cell, selected row with the lime bar and bold year,
  sticky column hairline below `xl`, the whole shot frame list).
- Risk: class conflicts between `row` and `selectedRow`. Mitigated by documenting `cn(row, selected && selectedRow)`
  and a test on `cn`. Accepted.
- Risk: the sticky hairline as a border would not stick (collapsed borders). The plan uses an inset shadow. Accepted.
- Risk: a merge conflict in `page.css` with #781. The rule is appended as its own block; master is merged before the
  merge. Accepted.
