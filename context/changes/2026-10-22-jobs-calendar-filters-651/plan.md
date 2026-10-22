---
change_id: jobs-calendar-filters-651
status: in_progress
---

# Plan: calendar filters on local-time schedules (issue #651)

Input: change.md, research.md. Complexity: small (two options, slot search, lateness rule, tests, docs).

## Phase 1: options, slots and lateness (TDD)

Files: `modules/jobs/src/options.ts`, `modules/jobs/src/server/schedules.ts`, `modules/jobs/tests/schedules.test.ts`,
`modules/jobs/tests/module.test.ts` (option validation).

1. Tests first:
   - Options: `daysOfWeek` / `daysOfMonth` parse and are sorted; empty, out of range (0, 8, 32), duplicates, non
     integers and a filter on `every` are refused.
   - `getScheduleSlot` with `daysOfWeek: [1..5]`: on Saturday gives Friday's last time; on Monday before the first
     time gives Friday's last time. `daysOfMonth: [10]`, `["last"]` (30-day and 31-day months, February), `[31]`
     skips April. Both filters: the date must match both. The 31st on a Monday is found 609 days back.
   - Slot monotonic minute by minute over a week with a weekday filter.
   - `enqueueDueSchedules` over a week enqueues only on matching dates.
   - `getQueueStats`: a weekday hourly 08-20 schedule with a Friday 20:00 success is not late on Monday 08:30, is late
     on Monday 09:00+ without a success; `everySeconds` on Saturday is 60h (Friday 20:00 to Monday 08:00).
2. Options: `daysOfWeek` (int 1-7) and `daysOfMonth` (int 1-31 or `"last"`), each 1+ unique values, only with `at`.
3. `schedules.ts`: walk local dates back (slot) and forward (next slot) up to 800 days; `everySeconds` = next slot
   minus current slot; `isLate` = now past the second slot after `since`.

## Phase 2: docs

`modules/jobs/README.md` (options table, Schedules section with examples, the `getQueueStats` text, Limitations),
`modules/jobs/CHANGELOG.md` `## Unreleased`.

## Progress

- [ ] Phase 1: options, slots and lateness
- [ ] Phase 2: docs
