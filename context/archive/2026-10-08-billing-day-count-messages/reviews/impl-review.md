# Implementation review: billing-day-count-messages

Reviewed: the branch against `plan.md` (both phases) and issue #280, commits `2a2403e` (formatters, messages, `/next`
export, tests) and the docs/version commit. Mode: autonomous.

## Plan conformance

- Phase 1: `dayCount` in both dictionaries; `formatDayCount`, `formatShortDay`, `formatShortLastDay` in `ui/format.ts`
  and `/ui`; `getBillingMessages` re-exported from `/next`; `tests/format.test.ts` covers every case the plan lists
  (exact strings, both locales, Warsaw day across a UTC midnight, an end at local midnight, an override reaching the
  formatter through `getBillingMessages`, the defaults without overrides). Seen red before the code existed (17 of 17).
- Phase 2: README summary, "Copy" with a formatter table and an example, CHANGELOG `0.1.10`, version in
  `package.json`, `module.json` and the manifest (the module test keeps them in step).
- `src/calendar.ts` untouched; no existing message or formatter changed, so 0.1.9 output is unchanged.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `formatMessage` prints the count with `String`, so a fractional day count read "1.5" in Polish, against the locale. | Fixed in Phase 1: `formatDayCount` formats the count with `Intl.NumberFormat(locale)` (`1,5` in pl, `1,000` in en), with tests. `formatDaysLeft` keeps `String` so the badge renders as in 0.1.9 (counts there are whole days below 1000 in practice). |
| 2 | Warning | The first commit attempt carried a literal Polish diacritic in a test expectation; the language gate caught it. | Fixed: written as a `\u` escape, as plan-review finding 1 required. |
| 3 | Suggestion | The README example reads `entitlement.daysLeft`, which is `number | null` for paid access. | Fixed: the example narrows to `status === "trial"`. |
| 4 | Suggestion | `en` dates are US order; a British app cannot get `22/11/2026`. | Not changed (plan-review finding 4): it follows the app's locale like `formatDay`. |

## Gates

`npm run typecheck`, `npm run lint` (ESLint and the language gate), `npm run build` green; `npm test` full run green
(see the PR's checks).

## Verdict

Approve. No open findings.
