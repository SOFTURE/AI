---
change_id: theme-notion-fold-row-padding-832
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (163d87a).

- Acceptance covered: default equal padding, `isInset` opt-in with today's classes, a test pinning both.
- Consistency with #831: same prop name and default; the content classes are local to each component, so the two
  changes touch different files and merge in any order.
- Compatibility: every existing call keeps compiling (the fixed-summary and table branches are today's props); the only
  visible change is the padding, written in the changelog with the one-prop migration.
- Types: discriminated unions instead of a bag of optionals; `summary` with `title` is a type error.
- Gap checked: `empty:hidden` still hides the content when there is neither a table nor children.

Verdict: approved, no changes.
