# @softure-ai/charts

The arithmetic of a chart as pure functions, with no DOM and no React, so the drawing, the cursor and
the tests share one source:

- linear and time scales with an inverse ([Scales](#scales));
- the peak of several series and round value ticks under it ([Value ticks](#value-ticks));
- calendar date ticks (days, months, years) at midnight in the app's time zone, labelled through
  `Intl` ([Date ticks](#date-ticks));
- the point nearest to a cursor ([Nearest point](#nearest-point)).

SVG components (axes, lines, legend, a keyboard cursor and a data table) arrive in this package with the
next roadmap item (CH-2). Extracted from FIRE_TRACKER's `chart-scale`, `chart-ticks` and `nearest-point`.

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

## Limitations

- Value ticks start at zero: a domain that does not include zero is not supported yet.
- Nothing here formats a value label; the value axis takes the app's formatter (CH-2).
- Weeks start on Monday (ISO 8601) whatever the locale.
- Ticks below a day (hours, minutes) are not supported.
