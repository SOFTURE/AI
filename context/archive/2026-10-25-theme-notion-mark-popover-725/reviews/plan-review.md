---
change_id: theme-notion-mark-popover-725
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and `themes/theme-notion` on master (f3c5ba2).

- Scope: one composition in `notion/`, covered by the theme contract's sources, so no theme-kit change; matches the
  issue's API and acceptance.
- Tests: every acceptance point (target wiring, `buttonData`, prevented text click, link click not prevented) plus
  the accessible name and the root export. happy-dom is already used in the repo for event tests.
- Compatibility: additive; next release is a minor-compatible patch for dependents (nothing depends on
  theme-notion).

Verdict: approved, no changes.
