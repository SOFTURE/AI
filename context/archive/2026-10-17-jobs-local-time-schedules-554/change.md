---
change_id: jobs-local-time-schedules-554
title: "jobs: schedules at local times of day in a time zone (issue #554)"
status: archived
roadmap_item: null
issue: 554
branch: claude/project-thread-xwkjzd
created: 2026-10-17
updated: 2026-10-17
archived_at: 2026-10-17
---

## Intent

Close [issue #554](https://github.com/SOFTURE/AI/issues/554) (labels `enhancement`, `pkg: jobs`, `adoption`): a
schedule can only be a UTC period (`every`), so an adopting app cannot run a job at 09:00 and 21:00 in its users'
time zone and keeps a host cron for it. Let a schedule name times of day in an IANA time zone,
`{ at: ["09:00", "21:00"], timeZone: "Europe/Warsaw" }`, enqueued once per local time, DST-safe.

## Context

jobs 0.1.1 is the latest on npm and on master. Releases are batched by the coordinator: no version bump here, the
CHANGELOG gets `## Unreleased`. The app migrates itself; the CHANGELOG and the issue comment describe the steps.

## Constraints

- Periods (`every`) keep working unchanged, the stored `jobs.schedules` rows included.
- At most one run per slot however many workers race, as for periods.
- No new dependency and no migration.

## Notes

- Framing: skipped. The issue names the gap, the shape of the option and the acceptance.

## Decisions (auto)

- A schedule is either `{ every }` or `{ at, timeZone }` (exactly one of `every` and `at`); both take `payload`.
- `timeZone` is required with `at`, no fallback to the app's `timezone`: the module options are parsed without the
  app config, and an explicit zone reads clearly in the config.
- Slots are computed with `Intl.DateTimeFormat` (no date library). A local time skipped by a DST change runs at the
  same wall-clock distance after the change (02:30 on a spring-forward day runs at 03:30); a local time that occurs
  twice runs once, at its first occurrence.
- `ScheduleState.everySeconds` stays, for an `at` schedule it is the longest nominal gap between two consecutive
  times (12h for 09:00 and 21:00, 24h for one time); `isLate` keeps "two of those".
