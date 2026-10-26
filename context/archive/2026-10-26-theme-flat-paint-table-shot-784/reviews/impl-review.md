---
change_id: theme-flat-paint-table-shot-784
verdict: approved
---

# Implementation review

- Plan conformance: every step of phase 1 is in `e3d5e3a`; the decisions hold (seven slots, sticky at every width,
  amount header as `headerCell` + `text-right`).
- Finding (fixed): the sticky cell inherits its row's background, and a header row has none by default, so a stuck
  header cell would be transparent. The slot's doc now says the header row takes `bg-surface`.
- Tokens only: no raw colour; the sticky hairline reads `var(--border)`, so it follows the scheme.
- Tests: the compiled CSS carries every class of the slot map and the exact `.shot-frame` rule (radius resolved to
  12 px); `cn` keeps the selected row's surface over the row's. Package tests 42/42, typecheck, lint, language gate,
  build green.
- Docs: README look maps table with an example, rules list names the class, CHANGELOG `Unreleased`.
