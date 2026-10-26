# Plan: core zoned-time helpers (issue #783)

## Phase 1: the helpers in core

Files: `foundation/core/src/zoned-time.ts` (new), `foundation/core/src/index.ts`, `foundation/core/src/config.ts`,
`foundation/core/tests/zoned-time-783.test.ts` (new), `foundation/core/README.md`, `foundation/core/CHANGELOG.md`.

1. Tests first: `getDayStartInstant` on a plain day, on the Warsaw spring-forward (2026-03-29) and fall-back
   (2026-10-25) days, in `America/New_York` (negative offset), and in a zone whose midnight is skipped
   (`America/Santiago`, 2026-09-06: 00:00 does not occur, gives 01:00); `getLocalDateTimeInstant` on a repeated hour
   (first occurrence) and a skipped hour (shifted forward); `isTimeZone` true/false (`""`, `Mars/Olympus`); a
   `RangeError` naming the function for an invalid zone, a malformed day and a malformed local date-time.
2. `zoned-time.ts`: the jobs algorithm, with `getWallClock(instant: Date, zone)` and `getZonedInstant(wallClock, zone):
   Date`; the two day helpers parse their input and delegate. Invalid zone: `RangeError` with the operation name.
3. Export from `index.ts`; `config.ts` uses the exported `isTimeZone`.
4. README section and `## Unreleased` in the CHANGELOG.

## Phase 2: jobs imports from core

Files: `modules/jobs/src/zoned-time.ts` (deleted), `modules/jobs/src/options.ts`, `modules/jobs/src/server/schedules.ts`,
`modules/jobs/CHANGELOG.md`.

1. Import from `@softure-ai/core`; adapt the two call sites (`new Date(instant)`, `.getTime()`).
2. CHANGELOG `## Unreleased`: no behaviour change; needs core 0.2.5 (range raised in the release).
3. The schedule tests pass unchanged.

## Decisions (auto)

- Export `getWallClock`, `getZonedInstant` and `WallClock` too: jobs needs them, and dropping its copy is the point.
- `Date`-based public API (as `toCalendarDay`), not epoch numbers; jobs converts at its two call sites.
- `isTimeZone("")` is false, as the config check had it.
- The jobs range on core is raised at release time (see change.md, Before the next release).

## Progress

- [x] Phase 1: the helpers in core (b502f01)
- [x] Phase 2: jobs imports from core (dfe9af3)
