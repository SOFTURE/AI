---
change_id: core-formatters-410
status: in-progress
---

# Plan: core formatters (issue #410)

Input: change.md, research.md. Complexity: small (six additive helpers in one package, one test file, docs).

## Phase 1: helpers (TDD)

Files: `foundation/core/src/format.ts`, `calendar-day.ts`, new `memoize.ts`, `config.ts`, `messages/{en,pl}.ts`,
`index.ts`; test `foundation/core/tests/core-formatters-410.test.ts`.

1. Tests first, red on master:
   - `formatCalendarMonth("2026-10", "pl")` is the nominative month and year, `"genitive"` the genitive, en
     `October 2026` both ways, `"roman"` gives `X 2026`; a day `2026-10-04` is accepted; `2026-13` throws.
   - `formatDuration`: pl 0, 1, 2, 5, 12, 14, 38, 60, 61 months (three years and two months, five years, one year and one month);
     en `1 year and 1 month`, `2 years`, `0 months`; negative or fractional throws.
   - `formatPercent(-50, "pl", { signed: true })` is `-0,5%`, `+12,5%`, zero never signed; `tight` removes the space
     (checked on a formatter output that has one, via a locale-independent assertion that no whitespace precedes
     `%`); `-0.4` basis points shows `0%`.
   - `memoizeByContent`: equal-content arguments (key order) hit the cache; LRU eviction at `max`; a rejected
     promise is not kept; unsupported argument throws; `max` not a positive integer throws.
   - `defineSoftureConfig` fills `landingOrigin` with `appOrigin`, keeps a given one, refuses one with a path.
   - `calendarDaySchema` accepts `2026-02-28`, refuses `2026-02-29` and `2026-2-1`.
2. Implement and export from `index.ts`.

## Phase 2: docs

`foundation/core/README.md` (formatting, memoization, landing origin), `foundation/core/CHANGELOG.md`
(`## Unreleased`).

## Progress

- [ ] Phase 1: helpers
- [ ] Phase 2: docs
