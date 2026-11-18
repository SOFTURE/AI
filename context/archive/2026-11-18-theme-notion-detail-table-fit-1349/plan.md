# Plan: DetailTable keeps to its column; DocumentRow details (#1349)

## Approach

Fix the cause in the theme, not in the app: a fixed table layout, and a wrapping place for a document's facts.

## Phases

### Phase 1: component (test-first)

- `tests/notion/DetailTable.test.tsx`: the table's classes start `w-full table-fixed`; the label width and the value's
  `wrap-anywhere` stay.
- `tests/notion/Document.test.tsx`: `details` renders after the size inside the open button, without `nowrap`, never
  in the actions; none for `undefined`, `null` or "".
- `visual/fit.spec.ts`: a copy of the gallery's detail table holding a document row with a long title and three
  28 px buttons in a 360 px parent stays inside it, the title is cut with an ellipsis, every button shows whole (fails
  without `table-fixed`, checked).
- Done when: the theme's unit tests, the fit test and the gallery pass; typecheck and lint clean.

### Phase 2: docs, version

- README, CHANGELOG, class parity fixture; `npm run release:version -- theme-notion minor` (0.26.0).

## Progress

- [x] Phase 1: component
- [x] Phase 2: docs, version

Evidence: `npx vitest run themes/theme-notion` 66 files, 1287 tests green; `npx playwright test visual/` 192 passed
with the committed baselines (no pixel changed); the fit case (360 px stacked, 600 px as a table) fails on all 4
projects with `table-fixed` taken out. The adopting app's e2e first showed that `table-fixed` alone left a 100 px
value cell beside a half-width panel, which added the container-based stacking.
