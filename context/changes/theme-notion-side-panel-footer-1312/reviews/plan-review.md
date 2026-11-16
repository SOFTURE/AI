# Plan review: theme-notion-side-panel-footer-1312

Verdict: approved, no blocking findings.

- Suggestion (accepted): assert the footer is outside `side-panel-content`, not only present, since staying out of
  the scroll container is the whole point. Added to Phase 1's tests.
- Checked: the change is additive (no caller passes `footer` today), the markup without `footer` is unchanged, the
  classes are theme tokens only, #1311 changes the same file but a different prop (`width`), so a later merge is a
  text conflict at worst.
