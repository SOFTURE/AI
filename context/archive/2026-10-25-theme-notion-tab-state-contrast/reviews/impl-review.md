---
change_id: theme-notion-tab-state-contrast
verdict: approved
---

# Implementation review

Reviewed the diff of 1cb39ac against plan.md and issue #760.

- Ask 1: the selected pill of the default variant has an `input` border at 3.13 (list) and 3.35 (pill) in light,
  3.30 and 3.11 in dark; `tests/contrast.test.ts` guards both neighbours in both schemes, and fails at 2.95 if the
  fill is not clipped.
- Ask 2: fill, shadow and text colour kept; the border is the field hairline. Before/after screenshots of both schemes
  show the same pill with a mid-grey outline; the line variant is unchanged.
- Ask 3: the pairs are in `tests/contrast.test.ts`; `tests/ui/tabs.test.tsx` checks the classes and
  `tests/theme-css.test.ts` the compiled order of the line override and the focus border.
- No token or export change. Docs: README "Contrast" sentence; CHANGELOG Unreleased entry with the ratios.
- Gates: typecheck, ESLint, language gate (pre-commit), `vitest themes/theme-notion` (146 passed).

Verdict: approved, no changes.
