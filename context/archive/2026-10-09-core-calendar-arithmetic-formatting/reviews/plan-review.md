# Plan review: core-calendar-arithmetic-formatting

Reviewed: `plan.md` against `change.md`, issue #312, the files it names, their tests, `tests/repo/release-rules.test.ts`
and the versions on npm.

Verdict: **approve with fixes applied** (two findings accepted into the plan, one recorded).

## Findings

### F1 (Warning): `wholeMonthsBetween` needs one rule for month ends — accepted
Two app copies disagree on Jan 31 → Feb 28. **Decision:** count with the same clamp `addCalendarMonths` uses, so
Jan 31 → Feb 28 is one whole month, and swapping the arguments negates the count. D1 says so; tests pin both
directions.

### F2 (Warning): the blog staleness rule must not start throwing — checked, accepted
`calendarDaysBetween` throws on a malformed day where the old copy returned `NaN`. `current_as_of` is validated by
the article parser (`z.iso.date()`), and `today` comes from `toCalendarDay`, so the rule never sees a malformed day.
No guard added.

### F3 (Suggestion): release order — recorded
The five modules will require core `^0.1.8`: core is released first, the modules after it (one wave).

## Checks that passed

- `formatCalendarDay(toCalendarDay(instant, zone), locale, "long")` gives the same text as `dateStyle: "long"` in
  `zone` on the instant: both name the same calendar day; billing's and mcp-access's tests pin the strings.
- The numeric style uses the same options as billing's `formatShortDay`.
- Moving the table keeps billing's `CURRENCY_MINOR_UNIT_DIGITS` export and its tests.
- `useGrouping: "always"` is typed by the ES2023 lib the repo targets and supported by Node 22.
