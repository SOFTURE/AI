# Research: core zoned-time helpers (issue #783)

## Findings

- `modules/jobs/src/zoned-time.ts` holds `WallClock`, `isTimeZone`, `getWallClock(instant: number, zone)` and
  `getZonedInstant(wallClock, zone): number`. A repeated wall time gives its first occurrence; a skipped one gives the
  instant the same distance after the change (02:30 on a spring-forward day gives 03:30). It uses a cached
  `Intl.DateTimeFormat` with `hourCycle: "h23"`. Consumers: `src/options.ts` (`isTimeZone` in the schedule schema) and
  `src/server/schedules.ts` (`getWallClock`, `getZonedInstant`). No test imports the file directly; the schedule tests
  cover it through `getNextRun` and the runner, across both Warsaw DST changes.
- `foundation/core/src/calendar-day.ts` has `toCalendarDay`/`getCalendarDay` (instant to day); `local-date-time.ts`
  has the branded `LocalDateTime` (`YYYY-MM-DDTHH:mm`) and `isLocalDateTime`. Errors are `RangeError`s that name the
  function.
- `foundation/core/src/config.ts` has a private `isTimeZone` for `timezone` in the app config (rejects `""`).
  `new Intl.DateTimeFormat("en-US", { timeZone: "" })` throws a `RangeError` on Node 22, so the explicit `""` check is
  only a guard for other runtimes.
- `foundation/testing/src/vitest/time-zone.ts` has another private `isTimeZone`, but testing does not depend on core,
  so it stays.
- jobs depends on `@softure-ai/core` `^0.2.0`; the workspace core is 0.2.4. A range of `^0.2.5` now would not be
  satisfied by the workspace (`tests/repo/release-rules.test.ts`), so it is raised in the release, as was done for
  `^0.2.4` (57f11c8).

## Conclusion

Add `foundation/core/src/zoned-time.ts` with the jobs logic and a `Date`-based public API: `isTimeZone`,
`getWallClock`, `getZonedInstant`, `getDayStartInstant`, `getLocalDateTimeInstant` and the `WallClock` type. Point
config.ts and jobs at it and delete the jobs copy.
