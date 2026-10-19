---
change_id: core-calendar-periods-599
title: "core: calendar periods and local wall-clock date-times next to calendarDaySchema (issue #599)"
status: preparing
roadmap_item: null
issue: 599
branch: claude/project-thread-i3jnji
created: 2026-10-19
updated: 2026-10-19
archived_at: null
---

## Intent

Close [issue #599](https://github.com/SOFTURE/AI/issues/599): `@softure-ai/core` offers calendar days but not the
two shapes apps build on them, so every app re-decides inclusivity, the error path and the message for a period
and for a local wall-clock date-time.

## Context

Labels: `enhancement`, `pkg: core`. core 0.2.0 is on master. Releases are batched by the coordinator: no version bump,
the CHANGELOG gets `## Unreleased`. Issue #598 adds a JSON GET helper to core in a parallel thread (other files, but
`src/index.ts`, README and CHANGELOG may conflict); fresh master is merged in before the merge.

## Acceptance

- `CalendarPeriod` and `calendarPeriodSchema`: both ends inclusive; `to` before `from` fails with path `["to"]`.
- `isDayInPeriod(day, period)`, `doPeriodsOverlap(a, b)`, `countPeriodDays(period)`.
- `LocalDateTime` (branded string), `localDateTimeSchema` whose day part goes through `isCalendarDay`, and
  `getLocalDay(value)`.
- English messages; the core README documents them next to calendar days; CHANGELOG `## Unreleased`.

## Constraints

Owns `foundation/core/src/calendar-period.ts`, `foundation/core/src/local-date-time.ts` and their tests. Touches
`foundation/core/src/index.ts`, README and CHANGELOG (shared with #598). No adopting app is changed.

## Notes

- Framing: skipped. The issue names the exact API.
