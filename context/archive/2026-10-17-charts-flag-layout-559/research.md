---
change_id: charts-flag-layout-559
---

# Research: flag layout (issue #559)

## What exists

- `ChartFlag` (`foundation/charts/src/svg/flag.tsx`): an absolutely placed chip at `top: 0` of the plot, at
  `left: xPercent`, aligned by `edgeAlign(xPercent)`: `start` below 18 %, `end` above 82 %, else `center`
  (`translateX(-50%)`). So a flag's extent depends on its alignment, not only on its x and width.
- `LineChart` (`src/svg/line-chart.tsx`) renders every visible flag as a `ChartFlag` in the plot overlay plus a
  `GuideLine`. All chips sit on row 0, so close flags overlap.
- `layoutEventAxis` (`src/svg/event-layout.ts`) already packs spans greedily into lanes (sort by start, lowest
  lane whose end is at or before the start). The same greedy rule fits flags, with a gap and a row cap.
- The plot overlay is HTML over the SVG; the server cannot measure text, so a helper that wants widths must take
  them from the caller (measured in the browser, or estimated from the label length).

## Options

1. Helper only (`layoutFlags`), apps place the chips. Smallest, but `LineChart` users still overlap.
2. Helper plus a `row` on `ChartFlag` and an opt-in `flagStack` on `LineChart` with a caller-given width per flag.
   Covers the issue's "used by the annotation layer when stacking is on" without measuring on the server.
3. Measure in a client component. Breaks server rendering of `LineChart`; rejected.

Choice: option 2.

## Shape

- Input per flag: `x`, `width` (same unit, e.g. plot percent) and optional `align` (`EdgeAlign`, default `center`),
  which turns into the extent `[start, end]`.
- Options: `gap` (default 0; flags whose extents are closer than `gap` share no row) and `maxRows` (default
  unlimited).
- Output: `placements` in input order, each `{ hidden: false, row }` or `{ hidden: true, row: null }` with its extent,
  plus `rows` (rows used) and `hiddenCount`, so the caller can draw a "+N" marker.
- Determinism: sort by start, then end, then input index; ties never depend on engine sort stability.
- Bad input (non-finite x or width, negative width, `maxRows` below 1 or fractional, negative or non-finite gap) is a
  programming error: `RangeError`, like the `TypeError` `LineChart` throws for mismatched series.

## Stacking in CSS

A row is a vertical offset of one chip height plus a small space. `ChartFlag` already uses `transform` for its
horizontal alignment; the individual `translate` property composes with it, and its percentage resolves against the
chip's own height: `translate: 0 calc(var(--sft-chart-flag-row) * (100% + var(--sft-space-1)))`. Row 0 stays where
it is today.
