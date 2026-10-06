# Plan: charts-scale-ticks

Input: change.md, research.md. Complexity: small-medium (two phases: package with scales and value ticks, then date
ticks and the nearest point).

## Goal

`@softure-ai/charts` (`foundation/charts/`, private 0.1.0) exports from `.`:

- `type ChartPoint = { readonly x: Date | number; readonly y: number }`, `type Domain<T>`, `type Range`.
- `linearScale({ domain, range })` and `timeScale({ domain, range })`: a function value → pixel with `invert`,
  `domain` and `range`; a zero-width domain maps every value to the range start and inverts to the domain start.
- `peakOf(series, { getValue, floor })`: the maximum over all series, never below `floor` (default 0).
- `valueTicks(max, target, { minStep })` and `yearTicks(startYear, endYear, target)`: FIRE's rules.
- `dateTicks({ start, end, target, timeZone })` → `{ unit, step, ticks: Date[] }` or `null` (empty span, target
  below 1): local midnights on day, month or year boundaries within `[start, end]`; and
  `formatDateTick(date, unit, { locale, timeZone })`.
- `nearestPointIndex(points, x)`: the index of the point whose x is closest to `x`, `null` for no points.

**Out of scope:** SVG, React, axis value labels (CH-2), palettes (CH-4), publishing (CH-5).

## Approach

Copy `templates/package/` to `foundation/charts/`, drop the server/next/ui entries, messages, `module.json` and
migrations. Code under `src/scale/`: `scale.ts`, `value-ticks.ts`, `date-ticks.ts` (with a private `time-zone.ts`
helper), `nearest-point.ts`, each with a colocated test. Tests are FIRE's, ported: same tabular oracles, with the
unit changes from research §2 (whole PLN instead of cents, `minStep: 1`, `floor: 1`, the scale's `invert` instead of
pixel geometry). New cases for the date ticks are a hand-written table (L-053), not a second implementation.

## Key decisions

- **The cursor uses the scale's inverse** (`nearestPointIndex(points, scale.invert(px))`), so the drawing and the
  cursor share one mapping by construction (FIRE L-031), instead of a second copy of the formula.
- **`peakOf` floors at 0 by default**; the degenerate domain is handled by the scale, so units with fractions
  (0.5) are not distorted. FIRE keeps its floor of 1 cent through the option.
- **Labels from `Intl`**: core has no date formatter, only the time zone in config (research §3).
- **Ticks inside `[start, end]` inclusive.** FIRE's year axis starts "today", which is rarely a boundary, so its
  "start year excluded" falls out; a start on a boundary is a valid tick.
- **No dependency on core**: the time zone is a plain string argument. An invalid zone is a programming error
  (core validates `config.timezone`), so `Intl`'s `RangeError` propagates.
- **Bounded candidates**: a candidate (unit, step) whose estimated count (span ÷ approximate unit length) exceeds
  four times the target plus two is skipped before any tick is generated, so a 100-year span never builds 36 500
  day ticks.
- **Weeks start on Monday** (ISO 8601) whatever the locale; documented as a limitation.
- **Ported tests are translated to English** (names and comments), per the language gate.

## Phase 1: Package, scales, peak and value ticks (test-after port)

- `foundation/charts/`: `package.json` (`@softure-ai/charts`, 0.1.0, private, one `.` export), `tsconfig*.json`,
  `README.md` (what it gives, install, API by example, limitations).
- `src/scale/scale.ts` + test (FIRE `chart-scale.test.ts` cases, plus `invert`, reversed range, `timeScale`).
- `src/scale/value-ticks.ts` + test (FIRE `chart-ticks.test.ts` value and year tables, minus `formatAxisAmount`).
- `src/index.ts` exports.

Done when: the ported tests pass and a deliberate break (step tie to the smaller step) turns them red;
gates green.

## Phase 2: Date ticks, labels and nearest point (TDD)

- `src/scale/date-ticks.ts` (+ `time-zone.ts`) + test: day, month and year tables in `Europe/Warsaw` across the
  March and October DST changes, `America/New_York`, an empty span and a target below 1 (`null`), the unit switch
  as the span grows, a 100-year span (years, not days), labels in `pl-PL` and `en-US`.
- `src/scale/nearest-point.ts` + test (FIRE `nearest-point.test.ts` cases through `linearScale().invert`, plus
  `Date` x and unsorted points).
- README sections for both.

Done when: the date tests were seen red before the code, then green; a tick computed in the machine's zone
(`TZ=America/New_York`) fails the Warsaw cases; gates green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Package, scales, peak and value ticks

#### Automated
- [x] 1.1 Ported scale and value tick tests green, seen red on a deliberate break — df8d58b
- [x] 1.2 Gates green (typecheck, lint, test, build) — df8d58b

### Phase 2: Date ticks, labels and nearest point

#### Automated
- [x] 2.1 Date tick tests seen red, then green, including DST in Europe/Warsaw — ad6a214
- [x] 2.2 Ported nearest-point tests green through the scale's inverse — ad6a214
- [x] 2.3 Gates green (typecheck, lint, test, build) — ad6a214
