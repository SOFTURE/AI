# Plan: theme-notion-fold-row-align-start

## Approach
All in `src/notion/FoldRow.tsx`. `FoldRowProps.align?: "center" | "start"` (default `center`). With `start`: the
summary, the summary slot and the fixed heading use `items-start`; the chevron is wrapped in a `fold-row-chevron`
box `flex h-lh shrink-0 items-center text-ui`, so it is centred on the first line; the right column uses
`md:justify-start` instead of `md:justify-center`. With `center` every class and the markup stay as in 0.36.0 (no chevron box).

## Phases
### Phase 1: `align="start"` (TDD)
- Tests first (red) in `tests/notion/FoldRow.test.tsx`: with `align="start"` the summary and the slot are
  `items-start`, the chevron sits in a one-line box, the right column is `md:justify-start` and not
  `md:justify-center`, for both summary shapes; the default keeps `items-center` and `md:justify-center`.
- Code, README (`FoldRow` paragraph), CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, typecheck, lint and build pass; a Chromium render at
  1280 px of the issue's repro shows the chevron, the title and the status on the first line.

### Phase 2: Design System artifact
- Update the bundled `FoldRow` and its types in the "NOTION · Design System" artifact, publish.

## Decisions (auto)
- An opt-in prop rather than a new default: a one-line summary in a touch-height row keeps its centred layout, and
  0.36.0 users see no change. Named `align` with `"center" | "start"` as the issue proposes.
- The chevron box is one `ui` line high (`text-ui h-lh`) instead of a fixed margin, so it follows the line height.
- Released as a minor (an additive optional prop, no dependent range broken).

## Progress
- [x] Phase 1: `align="start"` (TDD) (two new tests red before the code: the multi-line summary and the fixed title
  with `align="start"`; after: `npx vitest run themes/theme-notion` 1412 tests passed, `tests/repo` passed;
  typecheck, ESLint, the language gate and `npm run build` passed; the issue's repro rendered in Chromium at 1280 px:
  default chevron centre 54 px against the title's 30 px, `align="start"` chevron 158, title 158, status 161) cf4a826
- [x] Phase 2: Design System artifact (version 95-96: `FoldRow` functions patched in the minified `bundle.js`
  (`align` on the summary, the slot, the heading, the chevron box and the right column), two rules appended to
  `bundle.css` as a trailing `@layer utilities{}` (`h-lh`, `md:justify-start`), `align` in `index.d.ts`, a
  multi-line `align="start"` example on the FoldRow card; rendered in Chromium at 1280 px with no console error:
  chevron 481, title 481, status 484)
