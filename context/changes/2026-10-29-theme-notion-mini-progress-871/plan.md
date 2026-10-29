---
change_id: theme-notion-mini-progress-871
status: planned
---

# Plan: MiniProgress (issue #871)

Input: change.md, research.md. Complexity: small (one new composition file, tests, gallery case, docs, artifact).

## Phase 1: MiniProgress (TDD)

Files: `themes/theme-notion/src/notion/MiniProgress.tsx`, `src/index.ts`, `tests/notion/MiniProgress.test.tsx`,
`tests/contrast.test.ts`, `tests/gallery/cases.tsx`, `tests/fixtures/notion-slots.json`.

- Tests first: clamps `-5 → 0`, `140 → 100`, `NaN → 0` (indicator width, `aria-valuenow`, clip inset); the default
  label is the rounded percent (`37.4 → "37%"`); a string label becomes `aria-valuetext`, a node label leaves the
  percent; both copies `aria-hidden`; the clip inset is `100 - value`; `tone` sets `data-tone` and `TONE_FILL[tone]`;
  no tone keeps `bg-primary dark:bg-link`; `className` and other root props reach the root.
- `MiniProgress` as in the issue, in the package's style (`export function`, semicolons), with the label on the fill
  in `text-background` (see Decisions).
- Contrast pairs: `foreground` on surface + `primary/12`; `background` on the default fill (light `primary`, dark
  `link`) and each tone fill; each fill against the `primary/12` track.
- Gallery case `MiniProgress` next to `Progress`: 0, 3, 50, 100, a tone, a long label in a 96 px cell; parity fixture
  regenerated (`UPDATE_FIXTURES=1`).

## Phase 2: browser checks

- `visual/fit.spec.ts`: a copy of a rendered `MiniProgress` with a long label in a 96 px parent stays inside it, both
  label copies are cut with an ellipsis and stay inside the bar.
- Visual baselines for the new case in the four projects (the existing ones unchanged); axe passes.

## Phase 3: docs

README (composition list and a `MiniProgress` section next to `Progress`), CHANGELOG `## Unreleased`.

## Phase 4: design system artifact

NOTION · Design System: `MiniProgress` in the bundle, stylesheet classes, `index.d.ts`, a README card with a preview;
render-check light and dark.

## Decisions (auto)

- The label on the fill is `text-background`, not the issue's `text-primary-foreground`: white on the dark fills fails
  AA (2.5 to 3.4); the page background reaches 4.9 or more on every fill in both schemes (research.md).
- The label copies sit in their own `truncate` span inside an absolute flex row, as the issue proposes, so both cut at
  the same place.
- A node label (not a string) leaves `aria-valuetext` to Radix's default percent; apps pass `aria-label` for the name.
- No version bump: the coordinator releases (theme-notion minor).

## Progress

- [ ] Phase 1: MiniProgress
- [ ] Phase 2: browser checks
- [ ] Phase 3: docs
- [ ] Phase 4: design system artifact
- [ ] Implementation review
