# Plan: theme-notion-fold-row-action-column

## Approach
With `actions` or `status`, `FoldRow` becomes a grid: row 1 holds the `<details>` (its `<summary>` only) and the
action column, row 2 the opened content as a sibling shown by `peer-open`. Grid rows stretch their items, so the
column is as high as the summary. Below `md` the grid has one column: the action column falls under the summary.
Rows without actions or status do not change.

## Phases
### Phase 1: one bar with a status (TDD)
- `tests/notion/FoldRow.test.tsx` first (red): the grid wrapper; the details holds only the summary; the content is a
  sibling after the column, hidden until the details is open; the column stretches (no fixed height, no `items-start`)
  and lights with the summary; the `status` renders above the actions; `status` alone draws the column; phone classes
  (one column, 44 px controls). A behaviour test in Chromium (`visual/fit.spec.ts`): a three-line summary, a status and
  one action: the column's top and bottom equal the summary's, the status sits above the action, hovering the summary
  lights the column and hovering the column lights the summary; at 390 px the column sits under the summary and the
  action is at least 44 px.
- `src/notion/FoldRow.tsx`: the `status` prop; the grid layout; `data-slot="fold-row-status"` and
  `data-slot="fold-row-action-list"`.
- A gallery case `FoldRow[actions]` (three-line summary, status, one action); the parity fixture regenerated; the
  visual baselines updated and looked at; README (`FoldRow` paragraph), CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, typecheck and lint pass, the visual spec passes.

## Decisions (auto)
- The opened content moves out of the `<details>` only for rows with actions or a status (Research: the only CSS-only
  way to size the column to the summary). Find-in-page on a closed row with actions no longer opens it; accepted.
- `status` without `actions` still draws the column: the slot is about the right column, not the buttons.
- The column centres its stack vertically; the status sits right above the actions, both aligned to the right edge.
- Phone: the column falls under the summary as a row (status, then the actions), indented to the title (`pl-8`), and
  each direct child of the action list is at least 44 px high and wide. The summary drops its bottom rounding and
  the column its top rounding there, so the two still read as one box.
- Hover stays as today: hovering anywhere in the row (bar or opened content) lights the bar.
- Patch-level change recorded under `Unreleased`; the coordinator cuts the release together with #1463's fix.

## Progress
- [ ] Phase 1: one bar with a status
