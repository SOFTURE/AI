---
change_id: core-calendar-arithmetic-formatting
title: "core: calendar-day arithmetic and display formatting, modules switched (issue #312)"
status: archived
roadmap_item: null
issue: 312
branch: claude/project-thread-mb6zx1
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Day arithmetic on `YYYY-MM-DD` days and the display of days and money are re-implemented in several modules, with
different semantics (billing clamps `addMonths` to the month end, an adopting app overflows; five long-date
formatters; billing's `formatPrice` next to an app's own `formatMoney`)
([#312](https://github.com/SOFTURE/AI/issues/312)).

After this change `@softure-ai/core` exports, with documented semantics:

- arithmetic: `isCalendarDay`, `addCalendarDays`, `addCalendarMonths(day, n, { endOfMonth: "clamp" | "overflow" })`,
  `calendarDaysBetween`, `wholeMonthsBetween`;
- display: `formatCalendarDay(day, locale, style)`, `formatMoney(minor, currency, locale, { rounded, signed,
  compact })`, `formatPercent(basisPoints, locale)`; the pinned ISO 4217 minor-unit table moves from billing to
  core so money means the same everywhere.

The modules use them: billing (plans, calendar, UI dates, prices), analytics (funnel days), blog (dates, the
staleness rule), privacy (legal dates), mcp-access (token dates). Public names the modules export stay, delegating
to core.

A reviewer checks the diff of the six packages, the new tests, changelogs and versions.

## Context

- npm today: core 0.1.7, billing 0.1.10, analytics 0.1.9, blog 0.1.10, privacy 0.1.10, mcp-access 0.1.11, the same
  as the workspace, so every touched package takes a patch bump.
- Issue #311 (core) runs in parallel and also bumps core: both share one unreleased core version; whoever merges
  second folds its entry into the existing section.
- `release-rules` refuses an internal range the workspace version does not satisfy: the core bump and the module
  ranges go together.

## Constraints

- English-only code; neutral wording; no breaking change in a module's public exports.
- Day results stay the same for every valid input; the only visible change is money grouping (D4 in the plan).

## Process notes

- Research: skipped as a separate artefact. The issue names every copy; the reading fits in `plan.md` § Findings.
- Framing: skipped. A known duplication with a proposal in the issue; no competing explanation.

## Decisions (auto)

- charts (`foundation/charts/src/scale/time-zone.ts`) and deploy (`tools/deploy/src/verify/tls-check.ts`) are not
  switched; reasons in `plan.md` D6.
