---
change_id: blog-dash-pivot-699
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and change.md.

- Scope: both asks of the issue are met. A spaced dash is skipped only when both neighbours are numeric, and an
  em dash between two letters is a pivot. The issue's two Polish sentences are findings now.
- Compatibility: rule id, severity and message shape unchanged; ranges (`2020 – 2024`, `Pages 10—12`) and ranges
  with glued unit signs (`20% – 30%`, `$10 – $20`) pass; a glued en dash passes. One finding per block, as before.
- Docs: README rules row and `## Unreleased` in the CHANGELOG tell the adopting app it can drop its voice phrase.
- Gates: typecheck, ESLint, language gate (pre-commit); blog tests 747 passing.

Verdict: approved, no changes.
