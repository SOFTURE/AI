---
change_id: theme-notion-dialog-footer-close
verdict: approved
---

# Implementation review

Reviewed the diff against change.md and plan.md.

- Acceptance: `tests/ui/dialog.test.tsx` renders the issue's form (`DialogFooter showCloseButton` around a submit
  button inside a `<form>`): clicking the close button closes the dialog and the submit spy is not called; the
  button carries `type="button"`; the footer's children read `Cancel`, `Save`.
- The submit half of the issue does not reproduce: Radix `DialogClose` sets `type: "button"` and `Slot` keeps it.
  The tests guard it; no redundant prop was added (recorded under Decisions).
- Upstream guard: one delta for the moved block, listed after the #903 text delta. Parity fixture regenerated; only
  the two Dialog cases' button order changed.
- Gates: theme-notion suite 1022 tests green; typecheck, lint and the language gate green in pre-commit.
- Docs: README `dialog` note and CHANGELOG `## Unreleased`.

Verdict: approved.
