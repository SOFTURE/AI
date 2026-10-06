# Research: charts-scale-ticks

Date: 2026-10-06. Sources: FIRE_TRACKER `c910966` (read only), SOFTURE/AI `8136579`.

## 1. What FIRE has

| File | Exports | Domain coupling |
| --- | --- | --- |
| `src/lib/chart-scale.ts` (89 lines) | `capitalOf`, `peakOf(series)`, `scaleY({peak, height, paddingBottom})`, `scaleX({paddingLeft, width, horizonMonthIndex})` | `DisplayPoint` (accessible + locked cents); an 8 px top margin baked into `scaleY`; x is a month index |
| `src/lib/chart-ticks.ts` (143 lines) | `valueTicks(peakCents, target)`, `yearTicks(startYear, endYear, target)`, `formatAxisAmount(cents)`, `monthIndexOfYear(today, year)` | cents and a 1 PLN minimum step; Polish "mln"/"tys."/"PLN" copy; month-index axis |
| `src/lib/nearest-point.ts` (53 lines) | `nearestPointIndex(chartX, points, {width, paddingLeft, lastMonthIndex})` | pixel geometry repeated from `scaleX`; x is a month index |

Tests: `chart-scale.test.ts` (7 cases), `chart-ticks.test.ts` (tabular oracle written by hand, L-053),
`nearest-point.test.ts` (6 cases).

Rules worth keeping:

- **One scale for every reader** (FIRE L-031): the cursor must use the same mapping as the drawing. FIRE's
  `nearestPointIndex` repeats `scaleX`'s formula; the generic version takes the scale's inverse instead, so there is
  no second copy.
- **The divisor is the stated domain, not the last point** (horizon vs. last sampled point).
- **Ticks never exceed the peak**: the scale is not rounded up; ticks are round multiples under it, zero excluded.
- **Step choice**: mantissas 1, 2, 2.5, 5 × 10ⁿ; the count closest to the target wins, a tie goes to the larger step.
- **Degenerate inputs** (empty series, zero peak, zero horizon) give finite output, never `NaN` or `-Infinity`.

## 2. What maps to the generic API

| FIRE | Generic | Note |
| --- | --- | --- |
| `peakOf(series)` with `capitalOf` | `peakOf(series, { getValue, floor })` | `getValue` defaults to `point.y`; FIRE passes `capitalOf` and `floor: 1` |
| `scaleY`, `scaleX` | `linearScale({ domain, range })` with `invert` | FIRE's `scaleY` is `domain [0, peak]`, `range [height - paddingBottom, 8]`; a zero-width domain maps to the range start |
| — | `timeScale({ domain: [Date, Date], range })` | the same mapping over epoch milliseconds; `invert` returns a `Date` |
| `valueTicks(peakCents, target)` | `valueTicks(max, target, { minStep })` | units are the caller's; FIRE calls it with whole PLN and `minStep: 1` |
| `yearTicks` | `yearTicks` (unchanged) | for axes indexed by year number |
| `monthIndexOfYear` | `dateTicks` | FIRE-specific month-index axis; a time scale positions dates directly |
| `formatAxisAmount` | — (CH-2) | Polish copy and a currency; the value axis in CH-2 takes a formatter. `Intl.NumberFormat("pl-PL", { notation: "compact" })` gives the same "2,5 mln" / "500 tys." without copy in code |
| `nearestPointIndex(chartX, points, geometry)` | `nearestPointIndex(points, x)` | x in data space (`scale.invert(pixel)`); points of any order; ties keep the first |

## 3. Date ticks in the app's time zone

- Core holds the app's `timezone` in its config (`foundation/core/src/config.ts:16`, an IANA name checked with
  `Intl.DateTimeFormat`). Core has **no** date formatter: `i18n.ts` only fills message templates. So the unknown
  resolves to **`Intl`**: `formatDateTick(date, unit, { locale, timeZone })` formats with
  `Intl.DateTimeFormat`, the app passes its locale and `config.timezone`. No dependency on core is needed.
- A tick is the instant of local midnight on a calendar boundary in that zone. No date library: the zone offset at
  an instant comes from `Intl.DateTimeFormat(…).formatToParts` (measured on Node 22: `2026-03-29T01:30Z` in
  `Europe/Warsaw` gives 03:30, the summer offset). Wall time → instant needs one correction step for an offset
  change; midnight inside a DST gap (rare zones) resolves to the first valid instant after it.
- Units and steps: days 1, 2, 7, 14 (weeks start on Monday); months 1, 2, 3, 6 (aligned to January); years 1, 2,
  5, 10, 20, 25, 50 (FIRE's `YEAR_STEPS`, aligned to multiples). The same pick rule as the value ticks.
- The repository pins `TZ=America/New_York` for tests (`vitest.config.mts`), so a tick computed in the machine's
  zone instead of the given one fails the Warsaw cases.

## 4. Package shape

- Copy `templates/package/`, keep only the `.` export (no server, next or ui entry yet; CH-2 adds the components).
  A foundation package needs no `module.json` and no twelve README sections (`tests/repo/packages.test.ts`
  `isModule`); `@softure-ai/testing` is the precedent for README and `private: true` before its first publish.
- No messages: nothing user-facing in CH-1.
- Workspaces are found by glob (`foundation/*`), so build order, release rules and the package tests pick it up
  without registration.

## 5. Risks

- DST arithmetic is the one place to get wrong silently: covered by Warsaw cases at the March and October changes.
- `Number` precision in tick multiples (`3 000 000 / 1 000 000`): FIRE's `1e-9` tolerance stays.
