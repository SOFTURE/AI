---
change_id: theme-notion-code-badge-contrast
verdict: approved
---

# Implementation review

Reviewed the diff of c184f13 against plan.md and issue #763.

- `Code`: `text-code-foreground`, a new token `code-foreground` (light `#c33c39`, dark `#f86a66`), 4.61 and 4.62 on
  `secondary`; `tests/contrast.test.ts` guards the pair in both schemes. `red` is unchanged, so `Status`, tones,
  alert icons and the red progress fill keep their colour. The token is in the snapshot fixture in the same place.
- `cn` keeps `text-code` (text style) and `text-code-foreground` (colour) apart: the `Code` test checks the class
  list, and `tests/theme-css.test.ts` checks both compiled utilities (font size 13px, `color: var(--code-foreground)`).
- `Badge`: the colour classes are `compoundVariants` for every variant but `destructive`; a destructive badge with
  `color="default"` or any palette colour renders `bg-destructive text-destructive-foreground dark:bg-destructive/60`
  and no `-tag` class (tested for all ten colours); the other variants keep the colour (tested). The `color` prop
  type and default are unchanged.
- Look: a before/after render of both schemes shows the same code red and a white destructive badge text.
- Docs: README (`Code` paragraph, Contrast note, `badge` note), CHANGELOG Unreleased entry with before/after values
  and what an app changes. No version bump.
- Gates: typecheck, ESLint, language gate (pre-commit); `vitest themes/theme-notion` 183 passed.

Verdict: approved, no changes.
