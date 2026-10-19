# Research: core-calendar-periods-599

## What exists

- `foundation/core/src/calendar-day.ts`: `isCalendarDay` (real `YYYY-MM-DD` day, zero-padded, so string order is
  calendar order), `calendarDaySchema` (zod 4 `refine` with the message `must be a YYYY-MM-DD calendar day, e.g.
  2026-10-04`), `calendarDaysBetween(from, to)` (throws a `RangeError` naming the operation for a malformed day).
  Its parsing helpers are private.
- Error style in the file: `RangeError("<operation>: \"<input>\" is not a YYYY-MM-DD calendar day")`.
- `src/index.ts` re-exports by file, alphabetical-ish groups. README section "Calendar days" / "Day arithmetic"
  (lines ~315-336) with a function table and a line on `calendarDaySchema`.
- Brands: none in core yet. zod 4 is the dependency (`^4.6.5`); `.brand<"X">()` gives `string & z.$brand<"X">`,
  which is what `z.infer` returns, so the type and the schema agree.
- Tests run under `TZ=America/New_York`; nothing here touches zones.

## Semantics chosen

- A period's ends are both inclusive; one day is `{ from: d, to: d }` and counts 1 day.
- Overlap is inclusive: periods sharing one day overlap; `…-12-31` and `…-01-01` do not.
- A local date-time is exactly `YYYY-MM-DDTHH:mm`, hours 00-23, minutes 00-59; no seconds, no offset. Its order is
  string order, as for days.
- Functions throw a `RangeError` for a malformed input, like day arithmetic; the schemas return zod issues.

## Conflict risk

#598 adds a new file to core and will edit `src/index.ts`, README and CHANGELOG. Those are textual conflicts to
resolve at merge time; no shared logic.
