# @softure-ai/charts

Accessible line charts rendered on the server, and the arithmetic under them. The arithmetic is pure
functions, with no DOM and no React, so the drawing, the cursor and the tests share one source:

- linear and time scales with an inverse ([Scales](#scales));
- the peak of several series and round value ticks under it ([Value ticks](#value-ticks));
- calendar date ticks (days, months, years) at midnight in the app's time zone, labelled through
  `Intl` ([Date ticks](#date-ticks));
- the point nearest to a cursor ([Nearest point](#nearest-point)).

On top of it, React components ([Components](#components)): `LineChart` for time series, and the
primitives it is made of (plot, grid, lines, axes, legend, flags, a keyboard and pointer cursor, a data
table) for charts of your own, coloured by a six-colour series palette that a test guard keeps legible and
apart for colour-blind readers ([Series palette](#series-palette)). Extracted from FIRE_TRACKER's `chart-scale`, `chart-ticks`,
`nearest-point` and `src/components/chart/`.

## Installation

```bash
npm install @softure-ai/charts
```

Not on npm yet: the package is private until its first release (CH-5). Inside this repository it is a
workspace package.

## Points

A series is an array of `ChartPoint`, `{ x: Date | number; y: number }`. `y` is in the caller's unit (PLN,
cents, percent); nothing here assumes one.

## Scales

```ts
import { linearScale, peakOf, timeScale } from "@softure-ai/charts";

const peak = peakOf([base, variant]); // the maximum over every series, not the first
const y = linearScale({ domain: [0, peak], range: [height - 24, 8] }); // the peak sits 8 px under the top
const x = timeScale({ domain: [start, horizon], range: [8, width - 8] });

y(value); // pixel
x(date); // pixel; a Date or epoch milliseconds
x.invert(pointerX); // Date under the pointer
```

- The domain is what you state (a horizon), not the last point drawn, so a sparse series and the
  cursor stay on the same scale.
- A zero-width domain maps every value to the range start, so an empty chart draws finite numbers.
- `peakOf(series, { getValue, floor })` takes another value per point (a stack of parts) and a lowest
  peak; it floors at 0 by default.
- `invert` extrapolates outside the range; it does not clamp.

## Value ticks

```ts
import { valueTicks, yearTicks } from "@softure-ai/charts";

valueTicks(2_827_053, 4, { minStep: 1 }); // [500000, 1000000, 1500000, 2000000, 2500000]
yearTicks(2026, 2081, 5); // [2030, 2040, 2050, 2060, 2070, 2080]
```

Steps are 1, 2, 2.5 and 5 × 10ⁿ; the tick count closest to the target wins and a tie goes to the larger
step. Ticks are multiples of the step in `(0, max]`: the scale's peak never moves, only the grid lines are
placed, and zero is left to the baseline. `minStep` keeps a step from going below what the labels can show
(1 for whole units).

## Date ticks

```ts
import { dateTicks, formatDateTick } from "@softure-ai/charts";

const axis = dateTicks({ start, end, target: 5, timeZone: config.timezone });
// { unit: "year", step: 10, ticks: [Date, …] } or null
const labels = axis?.ticks.map((tick) => formatDateTick(tick, axis.unit, { locale, timeZone: config.timezone }));
```

- A tick is local midnight on a calendar boundary in the given IANA zone (core's `config.timezone`), not
  in the machine's zone: days (steps 1, 2, 7, 14; weeks start on Monday), months (1, 2, 3, 6, aligned to
  January) and years (1, 2, 5, 10, 20, 25, 50, aligned to multiples). Across a DST change each tick stays
  on midnight; a midnight that does not exist (a gap at 00:00) becomes the first instant after it.
- Ticks lie in `[start, end]`; the step rule is the value ticks'. `null` means nothing to show: an empty
  span, a target below one, or no boundary inside the span.
- Labels come from `Intl.DateTimeFormat` in the app's locale: `2026`, `Apr 2026`, `Apr 1` (`en-US`).
  Core has no date formatter, so nothing else is needed.
- Candidates with far more ticks than the target are skipped before they are built, so a century never
  builds day ticks.
- An invalid zone throws `Intl`'s `RangeError`: it is a configuration bug, caught by core at startup.

## Nearest point

```ts
import { nearestPointIndex } from "@softure-ai/charts";

const index = nearestPointIndex(points, x.invert(pointerX)); // number | null
```

The pointer's pixel goes through the same scale that drew the line, so the cursor and the drawing cannot
drift apart. Points may come in any order; a position off either end gives the edge point; of two equally
close points the first wins; no points gives `null`.

## Components

Import the stylesheet after `@softure-ai/ui`'s, which defines the `--sft-chart-*` tokens:

```css
@import "@softure-ai/ui/styles.css";
@import "@softure-ai/charts/styles.css";
```

### LineChart

```tsx
import { LineChart } from "@softure-ai/charts";

<LineChart
  title={messages.chart.title}
  series={[
    { key: "savings", label: messages.chart.savings, points: savings }, // { x: Date; y: number }[]
    { key: "spending", label: messages.chart.spending, points: spending, dashed: true },
  ]}
  flags={[{ key: "raise", x: raiseDate, label: messages.chart.raise }]}
  locale={config.locale}
  timeZone={config.timezone}
  formatValue={(value) => money.format(value)}
/>;
```

A server component. It draws a `<figure>`: the title as caption, value labels from zero to the peak
(`formatValue`), grid, one line per series, a dashed guide and a chip per flag, month or year labels in the
app's time zone, a legend, the cursor and the data table. Series share their x values (one table row and one
cursor stop per date; different dates throw a `TypeError`). `formatDate` changes the readout's and the
table's dates (a medium date in `timeZone` by default); `valueTickTarget` and `dateTickTarget` the number of
labels; `messages` the built-in copy.

### Accessibility

- The SVG is hidden from assistive technology. Every chart carries its data as a visually hidden
  `<table>` (`ChartDataTable`) with the title as caption.
- The cursor (`ChartCursor`, a client component) is a focusable group named "{title}. Use the left and
  right arrow keys…" (`chartsMessages.{en,pl}.cursor.label`). ← and → step through the points (the first →
  lands on the first, the first ← on the last), Home and End jump, Escape clears. The readout under the
  plot is a polite live region, so each point is announced with the text a sighted user reads.
- A pointer snaps to the nearest point; pointer events cover mouse, pen and touch, and
  `touch-action: pan-y` leaves vertical scrolling to the page while a sideways drag moves the cursor.
- Labels are HTML, never SVG text, so they do not stretch with the plot; strokes do not scale either.

### Primitives

| Component | What |
| --- | --- |
| `ChartPlot` | the SVG in one viewBox (`PLOT_WIDTH` × `PLOT_HEIGHT`, 1000 × 400) stretched to its box, plus an HTML `overlay` |
| `GridLines`, `Baseline`, `GuideLine`, `SeriesLine` | SVG lines in viewBox units; a guide is `dashed` or `dotted`, a series takes a colour `slot` (`seriesSlot(index)`) |
| `ValueAxis`, `valueAxisTicks` | value labels at heights in %; from four labels, every other one is hidden on narrow screens, counted from the top |
| `TimeAxis`, `timeAxisTicks` | date labels at % of the width; with `ends`, the ends sit at the edges and middle labels stay clear of them |
| `Legend`, `LegendItem`, `LegendSwatch` | swatches `box`, `dot`, `line`, `dashed`, `dotted` in a series slot |
| `ChartFlag` | a chip at the top of the plot; within 18 % of an edge it aligns to that edge (`edgeAlign`) |
| `ChartDataTable` | the visually hidden table |
| `ChartCursor` | the client cursor around the frame; takes `points` as percentages computed on the server |

Positions are percentages of the plot (`toPercent`), computed once from the scales, so the overlay and the
drawing cannot drift apart. Classes are `sft-chart-*` in the `softure` layer; an app's own classes win.

### Tokens

Colours: `--sft-chart-{grid,axis,cursor,flag,on-flag}` and the series palette `--sft-chart-series-{1…6}`;
sizes: `--sft-chart-{line-width,grid-width,dot-size,plot-height}` (all in `@softure-ai/ui`). The value axis
column is `--sft-chart-axis-width` (5 rem); set it on `.sft-chart` for wider labels.

### Series palette

Series take the colours in this order (`SERIES_TOKENS`, `SERIES_SLOTS = 6`); a seventh series repeats the
first, so tell it apart with `dashed`.

| Slot | Colour | Light | Dark |
| --- | --- | --- | --- |
| 1 | brand | `#356912` | `#cff26b` |
| 2 | ink | `#16171a` | `#f2f3f5` |
| 3 | purple | `#a855f7` | `#c084fc` |
| 4 | pink | `#db2777` | `#db2777` |
| 5 | blue | `#1e40af` | `#2563eb` |
| 6 | teal | `#0d9488` | `#14b8a6` |

Every colour keeps 3:1 (WCAG 1.4.11) on `color-background`, `color-surface` and `color-surface-raised`, and
every pair stays at least 10 ΔE00 apart in normal vision and under protan, deutan and tritan simulation, in
both schemes. Measured floors: 14.4 ΔE00 in light, 11.5 in dark (the brand and ink pair). Later slots sit
further from the colours already used, so a chart with three series has 27.6 in light. Six is a choice, not
a limit: a seventh colour family still fits at 12.4 ΔE00
([research](../../context/archive/2026-10-06-charts-palette-guard/research.md)).

An app that overrides the series colours checks them the same way, in its own tests:

```ts
import { DEFAULT_THEME, mergeThemes } from "@softure-ai/ui";
import { checkSeriesPalette } from "@softure-ai/charts/testing";

it("our series colours stay legible and apart for colour-blind readers", () => {
  expect(checkSeriesPalette(mergeThemes(DEFAULT_THEME, appTheme))).toEqual([]);
});
```

`checkSeriesPalette(schemes?, options?)` returns every failure at once: `low-contrast`, `missing-token` or
`unreadable-color` (from `@softure-ai/ui/testing`'s `checkThemeContrast`) and `collision` (`scheme`, `pair` as
`chart-series-1 and chart-series-3`, `vision`, `distance`, `minimum`). Options: `tokens` (the series, in slot
order), `grounds` (`SERIES_GROUNDS` by default), `minDistance` (10), `visions` and `metric`; with `tokens` and
`grounds` it checks an app's own token names. `@softure-ai/charts/testing` is never imported by the
components, so it stays out of app bundles.

## Limitations

- Values start at zero: the y domain is `[0, peak]`; a domain without zero (or negative values) is not
  supported yet.
- `LineChart` takes dates on x; numeric x needs the primitives.
- Weeks start on Monday (ISO 8601) whatever the locale.
- Ticks below a day (hours, minutes) are not supported.
