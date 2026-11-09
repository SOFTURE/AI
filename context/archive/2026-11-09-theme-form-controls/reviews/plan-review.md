# Plan review: theme-form-controls

Verdict: approved.

- Scope matches the intent; new exports only, so no upstream delta or existing baseline moves.
- Risk: subgrid needs a fixed span; a field with more children than `rows` overlaps. Mitigation: `rows` prop and the
  README tells apps to wrap extras (error, reset) in one element.
- Accessibility: the native input keeps the label association and keyboard focus; the visual button is
  `aria-hidden`, its focus ring follows the input (`peer-focus-visible`).
