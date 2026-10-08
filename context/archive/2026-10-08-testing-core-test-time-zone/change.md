---
change_id: testing-core-test-time-zone
title: "testing + core: pin the test time zone, and the calendar day in a zone (issue #251)"
status: archived
roadmap_item: null
issue: 251
branch: claude/project-thread-q3bm2j
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Two small generic pieces an adopting app still keeps as its own copies
([#251](https://github.com/SOFTURE/AI/issues/251)):

1. **Test time zone.** Code that converts explicitly to UTC or to the app's zone gives the same result as code that
   forgets the zone when tests run in UTC or in the machine's zone, so date tests can be green by construction. A
   negative-offset zone tells the two apart. After this change the `@softure-ai/testing/vitest-setup` file pins the
   process to such a zone by default, `TEST_TZ` or a config call picks another, and the worker-thread case that cannot
   switch zones fails loudly instead of running in the wrong zone.
2. **Calendar day in a zone.** Several places compute "today in the app's zone" by hand, and the bug class is the
   day computed in the process zone. After this change `@softure-ai/core` exports `toCalendarDay(instant, timeZone)`
   and `getCalendarDay(clock, timeZone)`, both returning `YYYY-MM-DD`.

## Context

- This repository already pins its own tests in `vitest.config.mts` (`TZ = TEST_TZ || "America/New_York"`, set in
  the main process before any worker starts); docs/02 §10 asks for a test zone other than UTC.
- `foundation/testing/src/vitest/setup.ts` only shifts the clock today.
- Copies of "the day in a zone": `modules/blog/src/pages/dates.ts` (`getDayInZone`),
  `modules/blog/src/quality/settings.ts`, `modules/privacy/src/next/route.ts`,
  `modules/mcp-access/src/token-status.ts` and `modules/billing/src/calendar.ts` (day numbers).

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording (no app or person named in code or docs).
- `@softure-ai/testing` stays at the unreleased 0.1.3 (opened by #245, not on npm yet); this change adds its lines
  there. `@softure-ai/core` gets a `## Unreleased` entry (npm has 0.1.6). No npm release in this change: releases
  happen only on the owner's word.
- Modules keep their own copies in this change: moving them onto core needs each module's core range raised to a
  core version that is not published yet. That move is #270.

## Process notes

- Research: skipped as a separate artefact. The issue names both pieces, the files are small, and the one open
  question (does `TZ` switch inside a worker thread) was measured directly; findings sit in `plan.md`.
- Framing: skipped. The issue states the problem, its cause and the shape of the fix.
