# Plan: core-calendar-arithmetic-formatting

Input: change.md (research and framing skipped; reasons there). Complexity: medium (two phases, six packages).

## Goal

`@softure-ai/core` owns calendar-day arithmetic and the display of days, money and percentages; billing,
analytics, blog, privacy and mcp-access use it; versions, changelogs and READMEs follow.

**Out of scope:** charts and deploy (D6); an adopting app's own copies (it switches after the release); time of
day formatting (`formatDateTime` in mcp-access stays).

## Findings (the reading behind the plan)

- billing `src/plans.ts:23` private `addMonths(dayNumber, months)` clamps to the month end; `getPeriodEnd` adds
  days, weeks, months and years on day numbers and turns them into instants with `getStartOfDay`.
- billing `src/calendar.ts`: `getDayNumber` (instant + zone), `getStartOfDay` (wall-time passes), `parseDay`
  (`YYYY-MM-DD` to a day number, null when invalid). All exported from the root.
- billing `src/ui/format.ts`: `formatDay`/`formatLastDay` (`dateStyle: "long"` in the app zone) and
  `formatShortDay`/`formatShortLastDay` (2-digit day and month). `src/price.ts` `formatPrice` reads the pinned
  table `src/currency-digits.ts` (ISO 4217, exported as `CURRENCY_MINOR_UNIT_DIGITS`).
- analytics `src/server/funnel.ts`: exported `formatDay(instant, zone)` is `toCalendarDay` by hand; private
  `addDays(day, delta)`.
- blog `src/pages/dates.ts` `formatDay(day, locale)` (long, UTC); `src/quality/rules/structure.ts` private
  `daysBetween` on `current_as_of`, which the article parser validates with `z.iso.date()`.
- privacy `src/ui/legal-document.tsx` `formatLegalDate(date, locale)`: long for a valid `YYYY-MM-DD`, the text as
  given otherwise.
- mcp-access `src/next/format.ts` `formatDate(config, date)`: long in the app's zone.
- charts `src/scale/time-zone.ts:72`: `toDayNumber`/`fromDayNumber` on a `{ year, month, day }` struct whose month
  and day may overflow on purpose (`Date.UTC` semantics) inside the tick loops.
- deploy `src/verify/tls-check.ts:38`: `getDaysLeft` counts whole 24-hour periods between two instants, and
  `formatDay` prints the UTC ISO day in a CLI line; deploy does not depend on core.

## Key decisions

- **D1 Day arithmetic in core, on strings.** `calendar-day.ts` gains `isCalendarDay(value)` (a real
  `YYYY-MM-DD` day, years 0000-9999), `addCalendarDays(day, days)`, `addCalendarMonths(day, months, { endOfMonth })`
  (`"clamp"` by default: Jan 31 + 1 month = Feb 28/29; `"overflow"`: Mar 3 in 2026, as `Date.UTC` does),
  `calendarDaysBetween(from, to)` (`to - from` in days) and `wholeMonthsBetween(from, to)` (the most months `n` with
  `addCalendarMonths(from, n)` not after `to`, clamped; negative with the arguments swapped). A malformed day or a
  non-integer count throws `RangeError`, like `toCalendarDay`.
- **D2 Display in core.** New `format.ts`: `formatCalendarDay(day, locale, style = "long")` with `"long"`
  (October 4, 2026; pl takes the month in the genitive), `"medium"` and `"numeric"` (04.10.2026 in pl), formatted at
  UTC midnight in UTC so no zone moves the day; `formatMoney(minor, currency, locale, options)` reads the pinned
  minor-unit table (else `Intl`'s digits for an unknown code), always groups thousands (`useGrouping: "always"`),
  `rounded` drops the fraction, `signed` shows `+`/`-` except for zero, `compact` uses the compact notation;
  `formatPercent(basisPoints, locale)` (1250 = 12.5%, at most two fraction digits). Formatters are cached per key.
- **D3 The table moves.** `currency-digits.ts` moves to core as `CURRENCY_MINOR_UNIT_DIGITS`; billing's file
  re-exports it, so billing's public export stays.
- **D4 Grouping is the one visible change.** billing's `formatPrice` becomes `formatMoney`: Polish four-digit
  amounts gain the thousands space (`1 234,56 €` instead of `1234,56 €`). Prices read the same in billing and the
  app; the test expectation changes with it and the changelog says so.
- **D5 Modules delegate, names stay.** billing `getPeriodEnd` uses `addCalendarDays`/`addCalendarMonths` (its
  `addMonths` goes), `parseDay` uses `isCalendarDay`, UI formatters use `formatCalendarDay` on `toCalendarDay`,
  `formatPrice` uses `formatMoney`; analytics `formatDay` returns `toCalendarDay` and `addDays` goes; blog
  `formatDay` and `daysBetween` delegate; privacy keeps the "text as given" fallback around `formatCalendarDay`;
  mcp-access `formatDate` delegates. billing's root exports `getDayNumber`/`getStartOfDay`/`parseDay` stay, with a
  README line pointing general day work to core.
- **D6 Not switched: charts and deploy.** charts works on overflowing `{ year, month, day }` structs inside tick
  loops; turning them into strings adds parsing to a hot path for no shared semantics (a concurrent change also
  edits charts). deploy counts 24-hour periods between instants, not calendar days, and would take a runtime
  dependency on core for one ISO slice. Both are recorded on the issue.
- **D7 Versions.** core 0.1.7 → 0.1.8; billing 0.1.11, analytics 0.1.10, blog 0.1.11, privacy 0.1.11, mcp-access
  0.1.12 (`package.json`, `module.json`, the manifest version where a module has one); the five ranges become
  `^0.1.8`; lockfile through `npm install`.
- **D8 Tests first.** `foundation/core/tests/calendar-arithmetic.test.ts` and `format.test.ts` are written before
  the code and seen failing (missing exports). Existing module tests pin the unchanged results; the billing price
  test changes only for D4.

## Phase 1: core

- Code: `calendar-day.ts`, `format.ts`, `currency-digits.ts`, `index.ts`. Tests: D8. Docs: README, CHANGELOG 0.1.8.

## Phase 2: modules

- Code: the files in D5; versions and ranges (D7). Docs: CHANGELOG entries, billing README.

Done when: gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: core

#### Automated
- [x] 1.1 Core tests written and seen failing
- [x] 1.2 Arithmetic, formatting and the currency table in core; tests green

### Phase 2: modules

#### Automated
- [x] 2.1 billing, analytics, blog, privacy and mcp-access delegate to core
- [x] 2.2 Versions, ranges, changelogs, READMEs, lockfile
- [x] 2.3 Gates green (typecheck, lint, test, build)
