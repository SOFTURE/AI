---
change_id: charts-flag-row-span-592
status: in_progress
---

# Plan: flags spanning several rows (issue #592)

Input: change.md, research.md. Complexity: small (one function, one component, its CSS, tests, docs).

## Phase 1: `rows` in layoutFlags (TDD)

Files: `foundation/charts/src/svg/flag-layout.ts`, `foundation/charts/tests/flag-layout-592.test.ts`.

1. Tests first, hand oracles:
   - a two-row flag over a later flag that overlaps only its lower row pushes that flag below both rows, while a flag
     far away still takes row 0 (no wasted row);
   - a one-row flag in row 0 leaves room for a two-row flag only from row 1, and `rows` counts the span (3);
   - `maxRows: 2` hides a two-row flag that could start only in row 1, and counts it;
   - `rows: 1` and no `rows` give the same layout;
   - the random property: no two shown flags whose spans share a row overlap, with mixed `rows`;
   - `rows` 0, 1.5, NaN throw a `RangeError`.
2. `getExtent` validates `rows`; the loop finds the lowest `row` where every spanned row is free, with
   `row + rows <= maxRows`; it writes the end to each spanned row.

## Phase 2: `rows` on ChartFlag

Files: `foundation/charts/src/svg/flag.tsx`, `foundation/charts/styles.css`, `foundation/charts/tests/flag-stack-559.test.tsx`
(new cases next to the `row` ones, or a new `flag-span-592.test.tsx`).

1. Tests first: `rows={1}` (or none) renders exactly as today; `rows={2}` adds `sft-chart-flag-span` and
   `--sft-chart-flag-rows:2`, at row 0 and at a lower row. Invalid `rows` (not a whole number of at least 1) is
   treated as 1? No: it throws a `RangeError`, like `layoutFlags`.
2. CSS: `--sft-chart-flag-pad-y` on the chip (0 for `sm`); `.sft-chart-flag-span` sets `box-sizing: border-box` and
   the min-height of `n` rows; `.sft-chart-flag-stacked` divides `100% + space-1` by `--sft-chart-flag-rows` (1 when
   unset), which leaves one-row chips as they are.

## Phase 3: docs

`foundation/charts/README.md` (Stacked flags: `rows` on the input and on `ChartFlag`, example), `CHANGELOG.md`
`## Unreleased` with the migration for the app that post-processes placements.

## Progress

- [ ] Phase 1: `rows` in layoutFlags
- [ ] Phase 2: `rows` on ChartFlag
- [ ] Phase 3: docs
