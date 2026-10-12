---
change_id: core-formatters-410
title: "core: month and duration formatters, signed percent, content memoization, landing origin, calendar-day schema (issue #410)"
status: in-progress
roadmap_item: null
issue: 410
branch: claude/project-thread-rgtr6y
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Close [issue #410](https://github.com/SOFTURE/AI/issues/410) (labels `enhancement`, `pkg: core`, `adoption`): after
#312 an adopting app still keeps formatting and config glue that belongs in core.

1. Month formatters: month and year in the nominative and the genitive (pl writes the month name in the
   nominative alone and in the genitive inside a date) and a Roman-numeral month for compact tables.
2. `formatDuration`: years and months with plural forms through `selectPlural`.
3. Signed values: `formatPercent` takes `signed` (`formatMoney` already does since #312) and `tight`, a percent
   without a space before `%`.
4. `memoizeByContent(fn, { max })`: an LRU cache keyed by the arguments' content, no TTL.
5. `landingOrigin` in the config: the public landing site beside `appOrigin`.
6. `calendarDaySchema`: a zod schema for a `YYYY-MM-DD` calendar day.

A reviewer checks `foundation/core/tests/core-formatters-410.test.ts`, the README and the CHANGELOG `Unreleased` entry.

## Context

core is at 0.1.9 on master. Releases are batched by the coordinator, so this change bumps no version: the CHANGELOG
`## Unreleased` section gets the entries.

## Constraints

- Additive only: every existing call keeps its output, except `formatPercent` no longer shows a minus on a value
  that rounds to zero (the same rule `formatMoney` got in #375).
- Copy (unit names, "and") lives in core's message dictionaries, not inline.
- No `node:` imports in the main entry: core runs in the browser too.

## Process notes

- Framing: skipped. The issue names each gap and the API it wants.

## Decisions (auto)

- No version bump; `## Unreleased` in the CHANGELOG (batched releases).
- Item 1: one function `formatCalendarMonth(month, locale, style)` with `style: "long" | "genitive" | "roman"`,
  taking `YYYY-MM` or a `YYYY-MM-DD` day; the Roman style is `X 2026`. Plus `isCalendarMonth`.
- Item 2: `formatDuration(months, locale)` takes whole months (what `wholeMonthsBetween` returns); zero is "0
  months", a part that is zero is left out.
- Item 3: `formatMoney` already has `signed` (#312); only `formatPercent` gains `signed` and `tight`. The minus sign
  stays the one `Intl` writes (hyphen-minus for en and pl).
- Item 4: the cache key is a canonical serialization of the arguments (exact, so no hash collisions); unsupported
  values (functions, symbols, class instances other than `Date`, cycles) throw a `TypeError`. A rejected promise is
  dropped from the cache.
- Item 5: `landingOrigin` is optional in `SoftureConfigInput` and always filled in `SoftureConfig` (defaults to
  `appOrigin`), validated like `appOrigin`.
