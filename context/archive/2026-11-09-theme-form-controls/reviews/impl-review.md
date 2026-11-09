# Implementation review: theme-form-controls

Verdict: approved.

- Matches the plan; new exports only. No `src/ui` file changed, so no upstream delta; the parity fixture gained the new
  cases' slots only.
- Accessibility: the native input keeps the label and the keyboard; axe on the gallery found the unlabelled and the
  half-opacity cases first, both fixed (gallery fields labelled; the drawn button is a disabled `button`).
- The equal 28 px height of `Input`, the default `SelectTrigger` and `FileInput` is pinned by a test.
- Visual check: the gallery's `FormGrid` case, light and dark, shows a two-line label beside a one-line one with both
  controls and hints on one line.
