# Plan: testing-core-test-time-zone

Input: change.md (research and framing skipped, reasons there). Complexity: small (two phases, two packages).

## Goal

Listing `@softure-ai/testing/vitest-setup` pins the test process to a negative-offset zone (`America/New_York`)
unless `TEST_TZ` names another, in every Vitest pool, or fails with a message that names the fix. `@softure-ai/core`
returns the calendar day of an instant or of a clock in a given zone.

**Out of scope:** moving the modules' own day helpers onto core (#270); this repository's root
`vitest.config.mts`, which already pins the zone without the package.

## Findings (the reading behind the plan)

- Measured on Node 22.22: assigning `process.env.TZ` in the main thread switches the zone at once (`Date` local
  getters and `Intl` defaults). Inside a `worker_threads` worker the assignment changes nothing: the zone stays
  what the process started with. Vitest's `forks` pool (the default) runs setup files in a child process, where the
  assignment works; the `threads` and `vmThreads` pools run them in a worker thread, where it does not. This is the
  per-pool caveat the issue mentions.
- A zone pinned in the main process (in `vitest.config.*`, before workers start) holds in every pool: forks inherit
  the environment, threads share the process zone.
- An unknown `TZ` value silently falls back to UTC, which would quietly disable the guard.
- `Intl.DateTimeFormat("en-CA")` output has changed format between ICU versions; `formatToParts` does not depend
  on the locale's pattern.

## Key decisions

- **D1** `src/vitest/time-zone.ts` (no imports, so a worker thread can load the source directly in a test):
  - `DEFAULT_TEST_TIME_ZONE = "America/New_York"`;
  - `readTestTimeZone(value)`: `TEST_TZ` value or the default when unset or empty; a name `Intl` does not know
    throws a `RangeError` naming `TEST_TZ`;
  - `pinTimeZone(timeZone)`: returns at once when the process already runs in that zone; otherwise sets
    `process.env.TZ`, then checks the zone took effect and throws, naming the worker-thread cause and both fixes
    (`pinTestTimeZone()` in the Vitest config, or the `forks` pool), when it did not;
  - `pinTestTimeZone(timeZone?)`: for the Vitest config; picks `TEST_TZ` or the given zone (default
    `DEFAULT_TEST_TIME_ZONE`), stores it in `TEST_TZ` so the setup file in every worker pins the same zone, pins
    it and returns it.
- **D2** The setup file calls `pinTestTimeZone()` before the clock shift (noon of `TEST_TODAY` is then computed in
  the pinned zone). Quiet: pinning is the expected default, unlike a shifted clock.
- **D3** Root entry exports the four names; README gets a "Test time zone" section; CHANGELOG lines in 0.1.3.
- **D4** `foundation/core/src/calendar-day.ts`: `toCalendarDay(instant, timeZone)` builds `YYYY-MM-DD` from
  `formatToParts` with one cached formatter per zone; an invalid date or an unknown zone throws a `RangeError`
  naming the function and the input. `getCalendarDay(clock, timeZone)` is `toCalendarDay(clock.now(), timeZone)`.
  README "Time" paragraph and a `## Unreleased` CHANGELOG entry.

## Phase 1: test time zone (testing, TDD)

- Tests (`tests/time-zone.test.ts`, `tests/vitest-setup.test.ts`): default and `TEST_TZ` reading, unknown zone
  rejected; `pinTimeZone` switches the zone and is a no-op when already there; inside a real worker thread it
  throws the documented message, and succeeds there when the zone is already the process zone;
  `pinTestTimeZone` honours `TEST_TZ` over its argument and stores the choice; the setup entry pins
  `America/New_York` by default and `TEST_TZ` when set. Every test restores `TZ`.
- Code: `src/vitest/time-zone.ts`, `setup.ts`, `index.ts`; README, CHANGELOG 0.1.3; package description.

Done when: tests seen red, then green; gates green.

## Phase 2: calendar day (core, TDD)

- Tests (`tests/calendar-day.test.ts`): an instant late in the evening in New York is the next day in Warsaw and
  UTC (exact strings); a day boundary across a DST change; a clock gives the same day as its `now()`; years below
  1000 padded; invalid date and unknown zone throw with the input in the message.
- Code: `src/calendar-day.ts`, `index.ts`; README, CHANGELOG `## Unreleased`.

Done when: tests seen red, then green; gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: test time zone

#### Automated
- [x] 1.1 Time zone tests seen red, then green
- [x] 1.2 README, CHANGELOG 0.1.3

### Phase 2: calendar day

#### Automated
- [x] 2.1 Calendar day tests seen red, then green
- [x] 2.2 README, CHANGELOG Unreleased
- [x] 2.3 Gates green (typecheck, lint, test, build)
