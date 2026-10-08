# Plan review: ui-action-form-submit-slot

Reviewed: plan.md against change.md, issue #230 and `foundation/ui/src/ui/{action-form,button,class-names,modal}.tsx`.

Verdict: **ready to implement** (no blocking findings).

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Suggestion | With an empty default, `slot("submit")` returns `undefined`, so `Button` receives no `className` and the markup without the slot is byte-identical. The plan's "unchanged without the slot" test should compare against a render without `classNames`, not against a hard-coded class string, so it does not break when the button look changes. | Accepted: the test compares two renders. |
| 2 | Suggestion | `fullWidthSubmit` adds the button's own `fullWidth` class in the page branch; the slot class must sit next to it, not replace it. Covered by `Button` joining `className` after `classNames.root`. | No change: covered by D1. |
| 3 | Check | Other references to the slot list: only the `ActionFormSlot` JSDoc and the README sentence on `cancel` (line 230). No docs page lists `ActionForm` slots. | No change. |
| 4 | Check | Lessons: a bug fix starts with a failing test; here a feature, still TDD (tests seen red first). | No change. |

No migration, no API removal, no cross-package impact (modules depend on `^0.1.7` and keep working).
