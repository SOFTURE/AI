---
change_id: charts-flag-layout-559
status: in_progress
---

# Plan: layoutFlags and stacked LineChart flags (issue #559)

Input: change.md, research.md. Complexity: small (one pure helper, one prop on `ChartFlag`, one opt-in on
`LineChart`, CSS, docs).

## Phase 1: `layoutFlags` (TDD)

Files: `foundation/charts/src/svg/flag-layout.ts`, `foundation/charts/tests/flag-layout-559.test.ts`,
`foundation/charts/src/index.ts`.

1. Tests first, hand-written oracles: rows for an overlapping set; `gap` splits flags that touch; `align` moves the
   extent (`start`, `center`, `end`); `maxRows` hides the rest and counts them; the result is in input order and
   the same for any input order of equal-start flags (ties by input index); empty input; `RangeError` for
   non-finite x or width, negative width, bad `maxRows`, bad `gap`; no two shown flags in one row overlap on a
   generated set.
2. `layoutFlags(flags, { gap, maxRows })` returning `{ placements, rows, hiddenCount }`; placements are a
   discriminated union on `hidden`. Export the function and its types.

## Phase 2: `ChartFlag` row and `LineChart` stacking (TDD)

Files: `foundation/charts/src/svg/flag.tsx`, `foundation/charts/src/svg/line-chart.tsx`,
`foundation/charts/styles.css`, `foundation/charts/src/messages/en.ts`, `foundation/charts/tests/flag-layout-559.test.ts`.

1. Tests first: `ChartFlag row={2}` sets `--sft-chart-flag-row: 2` and the stacked class, `row` 0 or omitted adds
   nothing; `LineChart` without `flagStack` renders as today; with `flagStack` each chip gets its row, hidden flags
   keep their guide but lose their chip, and one "+N" chip (copy `lineChart.moreFlags`) sits on the row after the
   last, at the first hidden flag's x, its `title` listing the hidden labels.
2. `ChartFlag` gets `row?: number`; CSS `.sft-chart-flag-stacked { translate: 0 calc(var(--sft-chart-flag-row) *
   (100% + var(--sft-space-1))) }`.
3. `LineChart` gets `flagStack?: { widthOf(flag): number; gap?; maxRows? }` (widths in percent of the plot width).

## Phase 3: docs

`foundation/charts/README.md` (helper, `row`, `flagStack`, migration from an app's own stacking),
`foundation/charts/CHANGELOG.md` `## Unreleased`.

## Progress

- [ ] Phase 1: layoutFlags
- [ ] Phase 2: ChartFlag row and LineChart flagStack
- [ ] Phase 3: docs
