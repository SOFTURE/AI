---
change_id: core-zoned-time-783
verdict: approved
---

# Implementation review

Reviewed commits b502f01 and dfe9af3 against plan.md and issue #783.

- Core: `foundation/core/src/zoned-time.ts` carries the jobs algorithm unchanged (offsets half a day either side,
  first occurrence of a repeated time, a skipped time shifted forward). The only difference is `toUtcMs`, which now
  uses `setUTCFullYear` like `calendar-day.ts`, so years 0-99 are not read as 1900-1999. Errors are `RangeError`s
  that name the public function; the cause keeps the `Intl` error.
- Tests: `foundation/core/tests/zoned-time-783.test.ts` (15 cases) covers the Warsaw spring-forward and fall-back
  days (23 and 25 hours), `America/New_York`, a skipped midnight (`America/Santiago`, 2026-09-06, checked against the
  runtime's tz data), the round trip with `toCalendarDay`, repeated and skipped local hours, and invalid input.
- Config: `defineSoftureConfig` uses the exported `isTimeZone`; its message and the `""` rejection are unchanged
  (core tests 504/504).
- jobs: the private copy is deleted; `options.ts` and `server/schedules.ts` import from core and convert at the two
  call sites. Schedule tests unchanged and green (214/214).
- Docs: core README section "Back to instants" with the calendar API example; CHANGELOG `Unreleased` in core and
  jobs. jobs needs core 0.2.5: the range is raised in the release (change.md, Before the next release), since a
  `^0.2.5` range now would not match the workspace.
- Gates: typecheck, ESLint, language gate (pre-commit), `npm run build` green.

Verdict: approved, no changes.
