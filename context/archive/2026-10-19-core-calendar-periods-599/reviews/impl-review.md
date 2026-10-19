---
change_id: core-calendar-periods-599
reviewed: 2026-10-19
verdict: approved
---

# Implementation review: core-calendar-periods-599

Reviewed: the branch diff against plan.md, change.md and issue #599.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every ask is exported from `@softure-ai/core`: `CalendarPeriod`, `calendarPeriodSchema`, `isDayInPeriod`, `doPeriodsOverlap`, `countPeriodDays`, `LocalDateTime`, `localDateTimeSchema`, `getLocalDay`, plus the guard `isLocalDateTime`. | No change. |
| 2 | Check | Plan review #2 caught a real case: zod 4 runs the object refinement even after a field fails, which gave a second issue on `to`. The refinement now skips unless both ends are real days; the test pins one issue on `from`. | No change. |
| 3 | Check | `LocalDateTime` is declared as `string & z.$brand<"LocalDateTime">` instead of `z.infer` (which was circular with the guard); the emitted `.d.ts` carries it and the test checks the schema's output equals it and a plain string does not extend it. | No change. |
| 4 | Check | Functions validate before comparing strings and throw a `RangeError` naming the operation, matching day arithmetic. | No change. |
| 5 | Minor | `getLocalDay` re-checks a value its type already guarantees; kept for values that were cast, at the cost of one regex. | No change. |
| 6 | Check | Docs: README sections next to calendar days, CHANGELOG `## Unreleased` with the migration; no version bump. Gates: typecheck, ESLint, core 24 files / 345 tests, repo tests, core build. | No change. |
