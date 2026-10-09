# Implementation review: core-calendar-arithmetic-formatting

Reviewed: the branch diff against `plan.md` (D1-D8, both phases) and the plan review's accepted findings.

Verdict: **approve** (no open blocking findings; two findings fixed in the change, one recorded).

## Plan conformance

- D1: `foundation/core/src/calendar-day.ts` adds the five arithmetic functions on `YYYY-MM-DD` strings. Day numbers
  go through `setUTCFullYear`, not `Date.UTC`, so years 0000-0099 are not read as 19xx; a result outside
  0000-9999 throws. `wholeMonthsBetween` counts with the clamped `addCalendarMonths` and negates for swapped days
  (plan review F1); tests pin Jan 31 → Feb 28 = 1 and the reverse = -1.
- D2: `foundation/core/src/format.ts` with `formatCalendarDay`, `formatMoney`, `formatPercent`; formatters cached
  per locale and options.
- D3: the table moved with `git mv`; `modules/billing/src/currency-digits.ts` re-exports it, so billing's export and
  its tests are unchanged.
- D4: the only changed test expectations are billing's Polish four-digit prices (`tests/price.test.ts`).
- D5: billing (`plans.ts`, `calendar.ts`, `ui/format.ts`, `price.ts`), analytics (`server/funnel.ts`), blog
  (`pages/dates.ts`, `quality/rules/structure.ts`), privacy (`ui/legal-document.tsx`), mcp-access
  (`next/format.ts`) delegate; every exported name stays.
- D6: charts and deploy untouched.
- D7: core 0.1.8; billing 0.1.11, analytics 0.1.10, blog 0.1.11, privacy 0.1.11, mcp-access 0.1.12 in
  `package.json`, `module.json` and the manifest in `src/index.ts`; ranges `^0.1.8`; lockfile from `npm install`.
- D8: the 28 core tests failed before the code (missing exports), then passed.

## Findings

### I1 (Warning, fixed): literal non-ASCII characters in the new test file
Expected strings were written with their characters (a Polish month, no-break spaces), which the language gate
and `no-irregular-whitespace` refuse. They are `\u` escapes now, as in billing's price test.

### I2 (Suggestion, fixed): a template literal on a narrowed `never`
After `!isCalendarDay(day)` the parameter narrows to `never` and the typed lint rule refuses it in the error
message; the message uses `String(day)`.

### I3 (Suggestion): `formatMoney` refuses a fractional amount — recorded
billing's `formatPrice` used to print a fractional amount; every price billing stores is validated as an integer
(`options.ts`, `z.number().int()`), so no caller reaches the new `RangeError`.

## Gates

typecheck, lint (ESLint and the language gate), test and build green on the branch.
