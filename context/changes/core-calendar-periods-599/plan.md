# Plan: core-calendar-periods-599

Input: change.md, research.md. Complexity: small (two new files, exports, tests, docs).

## Goal

Ship the issue's API in `@softure-ai/core` with tests and docs, additive only.

## Approach

Two files next to `calendar-day.ts`, built on its public `isCalendarDay` and `calendarDaysBetween`:

- `calendar-period.ts`: `CalendarPeriod { readonly from; readonly to }`, `calendarPeriodSchema` (object of two
  `calendarDaySchema`s plus a refine with path `["to"]`, message `must not come before from`), `isDayInPeriod`,
  `doPeriodsOverlap`, `countPeriodDays`. The functions check their inputs and throw a `RangeError` naming the
  operation for a malformed day or a period whose `to` comes first.
- `local-date-time.ts`: `isLocalDateTime`, `localDateTimeSchema` (`z.string().refine(isLocalDateTime, …).brand`),
  `LocalDateTime = z.infer<…>`, `getLocalDay(value)` returning the day part (throws a `RangeError` for a malformed
  value, for callers that cast).

Rejected: putting it all in `calendar-day.ts` (the file is already long and has one subject); a `Date`-based local
date-time (brings the process zone back in).

## Phase 1: calendar periods and local date-times (TDD)

Files: the two source files, `src/index.ts`, `tests/calendar-period-599.test.ts`, `tests/local-date-time-599.test.ts`.

Tests first: schema accepts equal ends and refuses `to` before `from` with path `["to"]` and the message; refuses a
malformed day; `isDayInPeriod` at both ends, inside, outside; `doPeriodsOverlap` for touching-one-day, adjacent,
contained, disjoint, symmetric; `countPeriodDays` 1 for one day, 366 for 2028, 29 days across DST-free Feb 2028;
RangeErrors with the operation name. Local date-time: valid, `2026-02-30T10:00`, `24:00`, `10:60`, seconds,
offset, lower-case `t`, non-string; `getLocalDay`; branded type compiles only from the schema or guard.

Done when: tests pass, exports from `@softure-ai/core`.

## Phase 2: docs

README "Calendar periods" and "Local date-times" next to calendar days; CHANGELOG `## Unreleased`.

## Risks and rollback

Additive exports only; rollback is reverting the commits. Conflicts with #598 are textual (index, README, CHANGELOG).

## Decisions (auto)

- Overlap and membership are inclusive at both ends, matching the period's own inclusivity.
- `isLocalDateTime` is exported too: the issue asks for the schema, and a guard is how core exposes `isCalendarDay`.
- No seconds in a local date-time: the issue's shape is `YYYY-MM-DDTHH:mm`.

## Progress

### Phase 1: calendar periods and local date-times

#### Automated
- [x] 1.1 Period and local date-time tests pass (31 tests, written first) — 393ff93
- [x] 1.2 Gates green (typecheck, lint, test; core 24 files, 345 tests) — 393ff93

### Phase 2: docs

#### Automated
- [ ] 2.1 README and CHANGELOG document the API; repo tests (links) pass
