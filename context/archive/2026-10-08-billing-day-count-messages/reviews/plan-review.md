# Plan review: billing-day-count-messages

Reviewed: `plan.md` against `change.md`, issue #280 and master `d217f9c` (`ui/format.ts`, `messages/*`,
`server/options.ts`, `next/index.ts`, core `module.ts`, `scripts/check-language.mjs`). Mode: autonomous.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The tests assert Polish strings, but the language gate (`scripts/check-language.mjs`) flags diacritics in every tracked file outside `messages/` and `pl/` folders, so a literal Polish expectation fails `npm run lint`. | Accepted: Phase 1 writes Polish expectations with `\u` escapes (precedent `tests/price.test.ts`). Applied to the plan. |
| 2 | Warning | The README documents none of the `/ui` formatters (`formatDaysLeft`, `formatDay`, `formatLastDay`, `formatPeriod`), so adding three more without a place to describe them leaves the new API undiscoverable. | Accepted: Phase 2 adds a "Formatters" paragraph to "Copy" listing all of them. Applied to the plan. |
| 3 | Suggestion | Point 1 of the issue is mostly there already (core merges `messages` for every module; `getBillingMessages` is in `/server`). The plan could be read as re-implementing it. | Accepted as written: the plan only re-exports from `/next` and adds the missing test; "Today" states what exists. No change. |
| 4 | Suggestion | `en` in `Intl` resolves to US order (`11/22/2026`); an app wanting `22/11/2026` in English has no knob. | Rejected: the formatter follows the app's locale like `formatDay`; a British app would need an `en-GB` locale in core, outside this change. |
| 5 | Suggestion | `src/calendar.ts` is touched by another open change; the plan must not edit it. | Confirmed: no phase touches it; the formatters only use `Intl`. |

## Verdict

Ready for implementation with findings 1 and 2 applied.
