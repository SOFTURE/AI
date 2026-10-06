# Implementation review: charts-scale-ticks

Date: 2026-10-06 · Verdict: approved, two fixes applied during implementation, nothing open

Reviewed `df8d58b` and `ad6a214` against plan.md, research.md and FIRE_TRACKER's three source files and tests.

## Plan vs. code

| Plan | Code | Match |
| --- | --- | --- |
| Private package 0.1.0, one `.` export | `foundation/charts/package.json` | yes |
| `linearScale`, `timeScale` with `invert`; zero-width domain to the range start | `src/scale/scale.ts` | yes (`Scale<Value, Input>`: a time scale takes `Date \| number`, inverts to `Date`) |
| `peakOf` with `getValue` and `floor`, default 0 | `scale.ts`, two overloads | yes; without `getValue` the type requires `ChartPoint` |
| `valueTicks(max, target, { minStep })`, `yearTicks` | `src/scale/value-ticks.ts` | yes, plus rounding of float noise in fractional steps |
| `dateTicks` → `{ unit, step, ticks }` or `null`, bounded candidates, Monday weeks | `src/scale/date-ticks.ts`, `time-zone.ts` | yes |
| `formatDateTick` through `Intl` | `date-ticks.ts` | yes |
| `nearestPointIndex(points, x)` in data space | `src/scale/nearest-point.ts` | yes |

## Tests seen red

- Value ticks: the tie broken to the smaller step fails `peak 12400000, target 3`.
- Date ticks: written before the module (missing-module red); ticks computed in `America/New_York` instead of the
  given zone fail all five Warsaw rows.
- The midnight-gap fallback removed fails the Santiago September row; the offset correction removed fails the
  Santiago April row (added during review: no Warsaw row depended on the correction, so it was unguarded).

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The second offset lookup in `getZonedMidnight` was untested: every Warsaw and New York midnight is right on the first guess. | Fixed in `ad6a214`: Santiago's fall-back day (offset of the guess differs from the answer), seen red without the correction. |
| 2 | Warning | The ported nearest-point case "a date halfway" put the cursor nearer to the next day than the comment said. | Fixed in `ad6a214`: the probe at 11:00 instead of 13:00. |
| 3 | Suggestion | `formatDateTick` builds an `Intl.DateTimeFormat` per call; an axis formats a handful of labels per render. | Left as is: no measurable cost at axis sizes; CH-2 can cache per axis if it ever matters. |
| 4 | Suggestion | Value ticks assume a domain from zero (FIRE's case). | Documented in the README's limitations; a gap only if a CH-2 chart needs a non-zero baseline. |

No security surface (pure functions, no input from outside the app), no migration, no copy (labels from `Intl`),
nothing published. Gates on `ad6a214`: typecheck, lint (ESLint and the language gate), `npm test` (4014 passed),
`npm run build`. No gap for `charts-followups`.
