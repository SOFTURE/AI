---
change_id: testing-clock-shift
title: "Test clock shift"
status: archived
roadmap_item: DP-6
branch: claude/project-thread-1ehr9o
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

A new package `@softure-ai/testing` (`foundation/testing/`) with a Vitest setup entry,
`@softure-ai/testing/vitest-setup`, that shifts the global `Date` to `TEST_TODAY` (`YYYY-MM-DD`) while
time keeps running, so an app's date guards can be checked for a day that has not come yet. The
functions behind it (`readTestToday`, `shiftClock`, `restoreClock`, `isClockShifted`) are exported for
an app that wants a fixed default day. Documented next to the injectable clock of `@softure-ai/core`.

## Context

Roadmap deploy, item DP-6 ([`backlog-input.md`](backlog-input.md)). Source: FIRE_TRACKER
`vitest.shift-clock.ts` (read only, copied and translated). PRD FR-35.

## Constraints

- Owns: `foundation/testing/` (scaffold, `src/vitest/`); doc lines in `foundation/core/README.md` and
  `docs/02-module-standard.md` §10.
- English only; the package has no user-facing copy, so no message dictionaries.
- No release, tag or publish: the package's first publish is DP-8 (owner). Version 0.1.0, as the
  roadmap names it.
- DP-7 (`testing-playwright-helpers`) adds `./playwright` to this package later; nothing here blocks it.

## Notes

- Research done ([`research.md`](research.md)): the source, how Vitest resolves `setupFiles`, and how the
  shift composes with `vi.useFakeTimers` (measured).
- Release: `"private": true` until DP-8, so an "all" release before then skips the package; DP-8 drops it.
- Framing skipped: the problem and the solution are given by the roadmap item and a working FIRE file;
  the only open question (fake timers) is a measurement, answered in research.
