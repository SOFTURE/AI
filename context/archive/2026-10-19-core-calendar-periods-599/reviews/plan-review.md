---
change_id: core-calendar-periods-599
reviewed: 2026-10-19
verdict: approved
---

# Plan review: core-calendar-periods-599

Checked plan.md against change.md, research.md, issue #599 and `calendar-day.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every ask of the issue maps to a plan item: type, schema with path `["to"]`, the three functions, the brand, the schema through `isCalendarDay`, `getLocalDay`, README. | No change. |
| 2 | Minor | zod 4 runs an object `refine` only when both fields parsed, so a malformed `from` gives one issue on `from`, not a second on `to`. | A test pins the single issue path for a malformed day. |
| 3 | Minor | The schema's output type must be assignable to `CalendarPeriod` so an app can pass a parsed value straight on. | A type-level assertion in the test. |
| 4 | Check | String comparison of zero-padded days and date-times is calendar order; the functions validate first, so a malformed input never compares silently. | No change. |
| 5 | Check | Additive exports, no version bump, no breaking change; #598 overlap is textual. | No change. |

No Critical findings.
