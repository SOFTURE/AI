---
change_id: theme-notion-tab-state-contrast
status: in_progress
---

# Plan: theme-notion selected tab state contrast (issue #760)

Input: change.md, research.md. Complexity: small (one class string, tests, docs).

## Phase 1: the selected pill boundary, tests and docs

Files: `themes/theme-notion/src/ui/tabs.tsx`, `tests/contrast.test.ts`, `tests/ui/` (a Tabs test),
`tests/theme-css.test.ts` if the compiled order needs a guard, `README.md`, `CHANGELOG.md`.

1. `TabsTrigger`: the active trigger of the default variant takes `border-input` and `bg-clip-padding` in both
   schemes (replacing the dark-only `border-border`); the line variant's active border stays transparent in both
   schemes; a focused trigger keeps `border-ring`.
2. `tests/contrast.test.ts`: a pair can name the stack under its indicator separately from the surface it is measured
   against; add the selected pill's `input` border (over the list) against the list and against the pill fill, light
   and dark.
3. A Tabs test asserts the classes: the active default trigger carries `border-input` and `bg-clip-padding`, the line
   variant's override is scheme-free.
4. README "Contrast" note and CHANGELOG `Unreleased` entry: before/after ratios, what an app changes (nothing, unless
   it restyles the active tab itself).

## Decisions (auto)

- A boundary in `input` rather than an underline or a filled pill (research): smallest change, one indicator, the same
  hairline as a field.
- `bg-clip-padding` instead of a darker or new token: with the border composited over the list the existing `input`
  passes in both schemes, so no token moves.
- `shadow-sm` and the text colour change stay: they add to the indicator and are part of the look.

## Progress

- [x] Phase 1: the selected pill boundary, tests and docs (1cb39ac)

## Notes from implementation

- The compiled order was checked, not only the class string: the line override and `focus-visible` border come after
  `data-[state=active]:border-input` (`tests/theme-css.test.ts` guards it).
- `contrast.test.ts` gained an optional `paintedOn` stack per pair, so the border is measured as the browser paints it
  (over the list) against both neighbours; with the border painted over the pill instead, light drops to 2.95 against
  the list, and the test fails.
