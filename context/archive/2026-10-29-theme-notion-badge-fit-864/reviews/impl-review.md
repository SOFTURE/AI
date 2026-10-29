---
change_id: theme-notion-badge-fit-864
verdict: approved
---

# Implementation review

Reviewed the diff from e96ac81 against plan.md.

- Acceptance of #864 met: every badge carries `max-w-full`, so it stays within its parent; `Status` puts its word in a
  `min-w-0 truncate` `status-label` span and keeps its icon from shrinking, so a long word ends in an ellipsis and the
  icon stays 16 px; the full word is the `title` for a string or number, overridable by the new `title` prop.
- The browser spec measures it in a 120 px parent in all four projects (desktop and phone, light and dark); it fails on
  master. The 84 existing visual tests pass unchanged, so a fitting badge renders the same pixels.
- `justify-center-safe` keeps the start of a clipped plain `Badge` text; recorded under Decisions.
- Upstream guard: both base-string changes ride the focus-ring delta, its reason extended. The parity fixture is
  refreshed (class order only besides the new classes and the `status-label` slot).
- Docs: README describes the narrow-container behaviour; CHANGELOG `## Unreleased` lists what an app drops.
- Design system: the artifact's bundle, stylesheet, types and READMEs carry the change, render-checked in both schemes.
- Gates: typecheck, lint and the language gate green in the pre-commit hook; 878 theme-notion tests and 92 visual tests
  pass.

Verdict: approved, no changes.
