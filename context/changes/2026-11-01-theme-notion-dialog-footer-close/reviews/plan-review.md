---
change_id: theme-notion-dialog-footer-close
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master.

- Acceptance: the form test with a submit spy covers "closes and does not submit"; the DOM order test covers the
  cancel-then-confirm order through the existing `flex-col-reverse sm:flex-row` classes.
- Compatibility: `type="button"` changes nothing outside a form. Moving the button changes the visual order for apps
  that already use `showCloseButton` with children; that is the fix the issue asks for and is noted in the CHANGELOG.
- Guard: the moved block needs one delta covering both the order and `type`, after the #903 text delta.

Verdict: approved, no changes.
