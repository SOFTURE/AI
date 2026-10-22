---
change_id: jobs-calendar-filters-651
---

# Research: calendar filters on local-time schedules (issue #651)

## Current code

- `modules/jobs/src/options.ts`: `scheduleSchema` is a strict object with `every` or `at` + `timeZone`, transformed
  into `PeriodScheduleOptions | LocalTimeScheduleOptions`.
- `modules/jobs/src/server/schedules.ts`: `getScheduleSlot` gives the latest listed local time at or before `now`,
  looking at today's and yesterday's local dates only (`getLocalTimeSlot`). With a calendar filter the latest
  matching date can be weeks back, so the search must walk dates.
- `getScheduleStates` computes `everySeconds` (longest nominal gap between times for `at`) and
  `isLate = now - since > 2 * everySeconds`. A weekday schedule polled hourly 08-20 would report 13h (the overnight
  gap) and turn late every Monday at 10:05.
- The worker (`run-job-worker.ts`) and `enqueueDueSchedules` only call `getScheduleSlot` and `enqueueScheduledRun`;
  the once-per-slot guarantee is the `last_slot_at < slot` upsert, which needs monotonic slots only.

## Calendar arithmetic

Matching a date needs no time zone: the local date of `now` comes from `getWallClock`, then `Date.UTC(y, m - 1, d)`
gives the weekday (`getUTCDay`, mapped to ISO 1-7) and the month length (`Date.UTC(y, m, 0)`). Only matching dates
cost `getZonedInstant` calls.

## Bound of the search

A brute force over 2000-2799 (two 400-year cycles) for every `daysOfMonth` value with every single weekday gives the
longest gap between two matching dates: 609 days (the 31st on a Monday). Any other filter (more weekdays or days) is
a superset and recurs sooner. 800 dates back and forward always find a slot.
