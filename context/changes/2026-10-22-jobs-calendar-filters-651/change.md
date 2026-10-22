---
change_id: jobs-calendar-filters-651
title: "jobs: calendar filters on local-time schedules (issue #651)"
status: in_progress
roadmap_item: null
issue: 651
branch: claude/project-thread-rkkc5h
created: 2026-10-22
updated: 2026-10-22
---

## Intent

Close [issue #651](https://github.com/SOFTURE/AI/issues/651) (labels `enhancement`, `pkg: jobs`): an `at` schedule
runs on every local date, so an app that needs "Monday to Friday", "on the 10th" or "on the last day of the month"
runs the job daily and returns early in its handler, and `getQueueStats` then judges lateness from the daily cadence.
Add `daysOfWeek` (ISO 1-7) and `daysOfMonth` (1-31 and `"last"`) to `at` schedules, evaluated on the local date in
`timeZone`, and make `everySeconds` / `isLate` follow the real gaps between slots.

## Context

jobs 0.1.4 is the latest on master. Releases are batched by the coordinator: no version bump here, the CHANGELOG gets
`## Unreleased`. #653 and #654 (also jobs) wait for this merge.

## Constraints

- `every` schedules and unfiltered `at` schedules keep their slots; stored `jobs.schedules` rows stay valid.
- At most one run per slot however many workers race; slots only move forward as the clock does.
- Missed slots still collapse into one run for the current slot.
- No new dependency and no migration.

## Acceptance

1. `{ at, timeZone, daysOfWeek: [1..5] }` enqueues on weekdays only; `daysOfMonth: [10]` on the 10th only;
   `daysOfMonth: ["last"]` on the last local date of each month; both filters together need both to match; 31 never
   matches in a 30-day month.
2. Empty lists, out-of-range or duplicate values, and a filter on an `every` schedule are refused at config load.
3. A weekday schedule is not late on Monday morning after a Friday success; `everySeconds` is the gap from the
   current slot to the next one.

## Notes

- Framing: skipped. The issue names the gap, the option shape and the acceptance.

## Decisions (auto)

- Filters apply to `at` schedules only; on `every` they are refused (a UTC period has no local date).
- Both filters given: a date must match both (as the issue says), not either (cron's OR rule).
- For every `at` schedule (filtered or not) `isLate` becomes "the second slot after the last success (or after a
  worker first saw the schedule) has passed", and `everySeconds` the gap from the current slot to the next. For a
  fixed cadence that is the old "two periods"; for uneven times it follows the real gaps, which the issue asks for.
  `every` schedules keep their rule unchanged.
- Slot search looks back and forward at most 800 local dates: the rarest combination (the 31st on a given weekday)
  recurs within 609 days over a full 400-year Gregorian cycle.
