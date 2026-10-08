---
change_id: modules-core-calendar-day
title: "modules: compute calendar days with core's toCalendarDay instead of local copies (issue #270)"
status: plan_reviewed
roadmap_item: null
issue: 270
branch: claude/project-thread-244cg7
created: 2026-10-08
updated: 2026-10-08
---

## Intent

Four modules format "the calendar day of an instant in a zone" by hand with `Intl.DateTimeFormat("en-CA", …)`,
relying on that locale's date pattern (`YYYY-MM-DD`), which has changed between ICU versions. Issue #251 adds
`toCalendarDay(instant, timeZone)` and `getCalendarDay(clock, timeZone)` to `@softure-ai/core`, built from
`formatToParts` ([#270](https://github.com/SOFTURE/AI/issues/270)).

After this change every listed copy goes through core's `toCalendarDay`:

- blog: `getDayInZone` (`src/pages/dates.ts`) and `getLocalDate` (`src/quality/settings.ts`);
- privacy: the export file name in `src/next/route.ts`;
- mcp-access: `getDayNumber` in `src/token-status.ts`;
- billing: `getDayNumber` in `src/calendar.ts` (its wall-time code for `getStartOfDay` stays, issue's own note).

No `en-CA` formatter is left in `modules/` or `foundation/`. Each of the four modules requires `@softure-ai/core`
`^0.1.7`, the first core version that ships the helpers; core is versioned 0.1.7 in this change.

A reviewer checks the diff of the five packages, the new tests, the changelogs and the versions.

## Context

- `toCalendarDay` lands with PR #272 (issue #251) under core's `## Unreleased`; npm has core 0.1.6. This change
  starts its implementation only after #272 is on master.
- npm versions today: core 0.1.6, blog 0.1.9, privacy 0.1.8, mcp-access 0.1.8, billing 0.1.8. So blog needs a new
  version (0.1.10); privacy, mcp-access and billing already carry an unreleased 0.1.9 on master and get entries
  there.
- `release-rules` refuses an internal `@softure-ai/*` range that the workspace version does not satisfy, so the
  core bump and the range change go together.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Public exports stay: `getDayInZone` (blog `/pages`) and `getLocalDate` (blog `/quality`) keep their names and
  results, now delegating to core.
- Behaviour is unchanged for every valid input; the change removes a dependence on one locale's pattern.

## Process notes

- Research: skipped as a separate artefact. The issue names every file; the reading (five functions, their tests,
  the versions on npm and the release rule on ranges) fits in `plan.md` § Findings.
- Framing: skipped. The problem is a known duplication with a ready replacement in core; there is no competing
  explanation or cheaper path to weigh.
