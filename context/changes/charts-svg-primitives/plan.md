# Plan: charts-svg-primitives

Input: change.md, research.md. Complexity: medium (three phases: tokens and server primitives, then the cursor, the
table and the composition, then the example page and its e2e).

## Goal

`@softure-ai/charts` (still private 0.1.0) exports from `.`, next to CH-1's arithmetic:

- geometry: `PLOT_WIDTH` (1000), `PLOT_HEIGHT` (400), `toPercent(units, length)`, `percent(value)` (CSS, at most two
  decimals), `edgeAlign(xPercent)` (`"start" | "center" | "end"`, the 18/82 rule), `linePath(points)`;
- tick helpers: `valueAxisTicks({ ticks, scale, format })` (a zero tick at the bottom, `fromBottomPercent`) and
  `timeAxisTicks({ ticks, unit, scale, locale, timeZone, edgeMargin })` (edge-aligned ends, middle ticks off the
  edges and `minor` on phones);
- server components: `ChartPlot` (the stretched SVG with an HTML overlay), `GridLines`, `Baseline`, `GuideLine`
  (`dashed` / `dotted`), `SeriesLine` (`series` 1–3, `dashed`), `ValueAxis` (every other label `minor`, counted from
  the top, at four labels or more), `TimeAxis`, `Legend` / `LegendItem` / `LegendSwatch` (`box`, `dot`, `line`,
  `dashed`, `dotted`), `ChartFlag` (a chip at the top of the plot, edge-aligned), `ChartDataTable` (visually hidden);
- a client `ChartCursor` (`src/cursor/`): pointer and keyboard, readout in `role="status"`;
- `LineChart`: title, series of `{ x: Date; y: number }`, optional flags, `locale`, `timeZone`, `formatValue`,
  optional `formatDate`, `messages`; draws everything above;
- `chartsMessages` (`en`, `pl`) and `@softure-ai/charts/styles.css`.

`@softure-ai/ui` 0.1.6 adds scheme tokens `chart-grid`, `chart-axis`, `chart-cursor`, `chart-flag`, `chart-on-flag`,
`chart-series-1…3` and shared tokens `chart-line-width`, `chart-grid-width`, `chart-dot-size`, `chart-plot-height`.

**Out of scope:** the palette's final values and its guard (CH-4), negative values (the y domain starts at 0, as in
FIRE), numeric x in `LineChart` (the primitives take any scale), publishing (CH-5), FIRE's domain parts (PLN labels,
age rows, unlock steps, surfaces).

## Approach

Components render plain elements with `sft-chart-*` classes; `styles.css` (plain CSS in `@layer softure`, like the
blog's) gives them colour and size from `--sft-chart-*` and `--sft-*` tokens only. Inline `style` carries only the
computed positions (`left`, `bottom`, `height` in %). The server computes every position from CH-1's scales;
`ChartCursor` gets `points: { xPercent; heading; values: { key; series; yPercent; text }[] }[]` and finds the
nearest with `nearestPointIndex` over `xPercent`, so the client never repeats a scale.

## Key decisions

- **One fixed viewBox, positions in percent** (research §3) instead of per-chart sizes: labels, flags and the cursor
  overlay are HTML at the same percentages the SVG uses.
- **Tokens are literal colours equal to today's roles** (grid = border, axis = muted, cursor = border-strong,
  flag = accent-fill, on-flag = on-accent, series 1–3 = accent, foreground, warning), not `var(--sft-color-…)`, so
  CH-3/CH-4's contrast checks read concrete values. CH-4 owns the series values and may grow the palette; a series
  index wraps around the palette.
- **The `chart-` family is not mapped into Tailwind** (like `duration-`): charts uses no Tailwind; the bridge test
  excludes it explicitly.
- **Pointer events only**, `touch-action: pan-y` (research §4).
- **`role="group"` + `role="status"`** for the cursor (research §5); first → lands on the first point, first ← on the
  last; Home/End; Escape and blur clear.
- **The SVG is `aria-hidden`; the table carries the data** with the title as caption.
- **Series share their x values.** One table row and one cursor stop per x; `LineChart` throws a `TypeError` when the
  series' x values differ (a programming error, like an invalid zone in CH-1). No points draws the frame, an empty
  table body and a cursor whose keys do nothing.
- **Cursor dots** are filled with the series colour and ringed in `--sft-chart-axis` (≥ 4.5:1 on the surface in
  both themes), so a dot stays visible whatever the series colour (FIRE RD-9).
- **Copy**: `chartsMessages.{en,pl}.cursor.label` (`{title}` + key hint) and `table.date`; components take `locale`
  and `messages` like ui's. Values and dates are formatted by the caller (`formatValue`) or `Intl` in `timeZone`.
- **`@softure-ai/core` becomes a dependency** of charts (`formatMessage`, `mergeMessages`, types); `react` a peer.
- **`@softure-ai/ui` patch bump to 0.1.6** (research §2); CH-3 may bump it too, the second merge keeps one bump.
- **Ported tests are translated to English**; FIRE's domain cases stay in FIRE.

## Phase 1: Tokens, package wiring and server primitives (test-after port)

- `foundation/ui/src/theme/tokens.ts` (+ README table, `styles.test.ts` exclusion, version 0.1.6).
- `foundation/charts/package.json` (`./styles.css` export and in `files`, core dependency, react peer), `styles.css`.
- `src/svg/geometry.ts`, `src/svg/axis-ticks.ts`, `src/svg/{chart-plot,lines,value-axis,time-axis,legend,flag}.tsx`.
- `src/messages/{en,pl,index}.ts`.
- `tests/primitives.test.tsx`: FIRE's generic cases (value ticks with zero and percent, thinning from the top and
  with zero, under four labels no thinning, time axis edges, flag anchor 18/82, guide pattern, legend swatches,
  percent rounding), plus `linePath` and the tokens' presence in the CSS.

Done when: the ported tests pass and a deliberate break (thinning counted from the bottom) turns them red; ui's
tests green with the new tokens; gates green.

## Phase 2: Cursor, data table and LineChart (TDD for the cursor)

- `src/cursor/chart-cursor.tsx` (`"use client"`) + `tests/cursor.test.tsx` (happy-dom): → from nothing goes to the
  first point, ← to the last, Home/End, clamping at the ends, Escape and blur clear, a pointer at 90 % of the width
  picks the nearest point, the status text equals the point's readout, the group's name comes from messages in
  `pl` and `en`.
- `src/svg/data-table.tsx`, `src/svg/line-chart.tsx` + `tests/line-chart.test.tsx`: two series and a flag rendered
  on the server: the table rows equal the points (hand-written dates in `Europe/Warsaw`), the series paths, the
  value labels from `formatValue`, the flag's guide line and chip, the legend; no points; series with different x
  values throw.
- `tests/architecture.test.ts`: no raw colour in `src/svg`, `src/cursor` and `styles.css`; no inline copy in
  components; every `var(--sft-…)` in `styles.css` names a ui token.

Done when: the cursor tests were seen red before the code, then green; gates green.

## Phase 3: Example page, e2e and docs

- `examples/next-app`: `@softure-ai/charts` as a `file:` dependency, `styles.css` import, `app/chart/page.tsx`
  (fixed monthly data for two series and one flag, copy in `messages/{en,pl}.ts`), `e2e/chart.spec.ts`: the table is
  reachable by its caption with one row per point; Tab to the cursor, → shows the first point in the status, End the
  last, Escape clears; a mouse at the right edge of the plot shows the last point.
- `foundation/charts/README.md`: components section; `foundation/ui/README.md`: chart tokens.

Done when: the e2e passes locally against the built app (or in the e2e workflow on the PR); gates green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Tokens, package wiring and server primitives

#### Automated
- [ ] 1.1 Ported primitive tests green, seen red on a deliberate break
- [ ] 1.2 ui tests green with the chart tokens
- [ ] 1.3 Gates green (typecheck, lint, test, build)

### Phase 2: Cursor, data table and LineChart

#### Automated
- [ ] 2.1 Cursor tests seen red, then green (keyboard, pointer, status, messages)
- [ ] 2.2 LineChart and table tests green with hand-written oracles
- [ ] 2.3 Architecture test green and catching planted colours and copy
- [ ] 2.4 Gates green (typecheck, lint, test, build)

### Phase 3: Example page, e2e and docs

#### Automated
- [ ] 3.1 Chart e2e green
- [ ] 3.2 READMEs describe the components and tokens
- [ ] 3.3 Gates green (typecheck, lint, test, build)
