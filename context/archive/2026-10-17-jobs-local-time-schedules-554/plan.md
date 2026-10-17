---
change_id: jobs-local-time-schedules-554
status: archived
---

# Plan: local-time schedules (issue #554)

Input: change.md, research.md. Complexity: small (one option shape, one slot function, tests, docs).

## Phase 1: options and slots (TDD)

Files: `modules/jobs/src/options.ts`, `modules/jobs/src/server/schedules.ts`, new `modules/jobs/src/zoned-time.ts`,
`modules/jobs/tests/schedules.test.ts`, `modules/jobs/tests/module.test.ts` (option validation, if it holds those tests).

1. Tests first:
   - `getScheduleSlot` for `{ at: ["09:00", "21:00"], timeZone: "Europe/Warsaw" }`: before 09:00 local gives
     yesterday's 21:00; between gives today's 09:00; exactly 21:00 gives 21:00.
   - Across the 2026-10-25 fall-back and the 2027-03-28 spring-forward: 09:00 local is 07:00Z in summer and 08:00Z in
     winter; a skipped 02:30 runs at 01:30Z (03:30 CEST); a repeated 02:30 runs once, at its first occurrence.
   - `enqueueDueSchedules` with an `at` schedule enqueues once per listed local time over two days that span the DST
     change, however often it is called.
   - Options: `at` without `timeZone`, an unknown zone, a bad or duplicate time, an empty `at`, both `every` and `at`
     are refused; `every` schedules parse as before.
   - `getQueueStats` reports `everySeconds` 43200 for 09:00/21:00.
2. Options: schedule = `{ every, payload }` or `{ at, timeZone, payload }` (zod union of strict objects).
3. `zoned-time.ts`: wall-clock parts of an instant in a zone and a local date and time to an instant.
4. `getScheduleSlot` and `getScheduleStates` handle both shapes.

## Phase 2: docs

`modules/jobs/README.md` (options table, Schedules section with the reminder example, the Limits line),
`modules/jobs/CHANGELOG.md` `## Unreleased` with the app's migration steps.

## Progress

- [x] Phase 1: options and slots (7ccfb84; `zoned-time.ts` moved to `src/` because the options schema validates the
  zone at startup and `src/options.ts` must not import from `server/`)
- [x] Phase 2: docs (README options table, Schedules, Limitations; CHANGELOG `## Unreleased` with the migration)
