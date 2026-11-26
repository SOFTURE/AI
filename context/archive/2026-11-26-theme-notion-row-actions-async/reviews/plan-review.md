# Plan review: theme-notion-row-actions-async

Verdict: approve. Every change is additive (optional props, a wider `onSelect` return type), so 0.35.0 users keep
their behaviour: a synchronous `onSelect` still closes the dialog at once. Preventing Radix's close in the action's
click handler and in `onCloseAutoFocus` uses the primitives' documented hooks instead of a non-modal menu. Each
acceptance line of the issue has a unit test, and the rejection path is tested so the dialog's re-enable is not
assumed. The touch size uses the same responsive rule as the row's controls, so the desktop menu does not grow.
