---
change_id: core-zoned-time-783
title: "core: the instant a calendar day (or local date-time) starts in a time zone (issue #783)"
status: archived
roadmap_item: null
issue: 783
branch: claude/project-thread-y9d2n2
created: 2026-10-26
updated: 2026-10-26
archived_at: 2026-10-26
---

## Intent

Close [issue #783](https://github.com/SOFTURE/AI/issues/783): `@softure-ai/core` turns an instant into a calendar day
but has no way back. Move the zoned-time helpers from `@softure-ai/jobs` (`src/zoned-time.ts`) to core and export
`getDayStartInstant`, `getLocalDateTimeInstant` and `isTimeZone` next to `calendar-day`; jobs imports them from core
instead of keeping its own copy.

## Context

- Labels: `enhancement`, `pkg: core`, `pkg: jobs`.
- An adopting app that queries a calendar API by the owner's days (`timeMin`/`timeMax` as RFC 3339 instants) copies
  the jobs logic today.

## Constraints

- No behaviour change in jobs schedules; its DST tests stay as they are.
- English only; no version bump (the coordinator releases).
- jobs will need `@softure-ai/core` `^0.2.5` once core is released; the range is raised at release time.

## Notes

- Framing: skipped. The issue names the gap, the API and the tests.

## Before the next release

- Release core first (patch, 0.2.5: additive API, and many packages depend on `^0.2.x`), then raise the
  `@softure-ai/core` range in `modules/jobs/package.json` to `^0.2.5` and release jobs (patch).
