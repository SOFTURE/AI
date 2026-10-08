---
change_id: billing-day-count-messages
title: "billing: getBillingMessages in /next, formatDayCount with its own plural table, short numeric dates (issue #280)"
status: archived
roadmap_item: null
issue: 280
branch: claude/project-thread-9osnuf
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Close every point of [issue #280](https://github.com/SOFTURE/AI/issues/280), so an app that writes its own sentences
around an access day count or shows a compact date keeps no copy or formatter of its own for them:

1. the module's copy with the app's `billing({ messages })` overrides, read from the Next.js adapter as
   `getBillingMessages(config)` (as `getFeatureSwitchesMessages` in feature-switches), with the merge covered by a test;
2. `formatDayCount(days, locale, messages)` in `/ui`, next to `formatDaysLeft`, from a new plural table
   `messages.dayCount` ("1 day" / "5 days" and the four Polish forms), overridable like every other message;
3. a short numeric date next to `formatDay` / `formatLastDay` (`22.11.2026` in pl).

A reviewer checks `tests/format.test.ts`, `tests/messages.test.ts`, the README "Copy" section and the CHANGELOG.

## Context

Issue #280, found while an adopting app moved its access formatters onto `formatDay` / `formatLastDay` /
`formatDaysLeft` (billing 0.1.9). Work is tracked in GitHub Issues: no roadmap item; the PR closes the issue.
Released as billing 0.1.10.

## Constraints

- Existing copy and formatters render exactly as in 0.1.9 (new message keys and functions only).
- `src/calendar.ts` stays untouched (another open change works on it).
- English-only code and docs; Polish only in `messages/pl.ts`.

## Process notes

- Research: skipped as a separate file. The issue names every gap and the code is small: reading `ui/format.ts`,
  `messages/*`, `server/options.ts` (`getBillingMessages` already exists there) and `defineModule` in core
  (`messages` overrides are merged for every module) answered every unknown; findings are in plan.md's "Today".
- Framing: skipped. The gaps are observed in an adopting app and the proposal fits the existing module standard; the
  only open choices (where the plural table lives, which short date form) are settled in the plan.
