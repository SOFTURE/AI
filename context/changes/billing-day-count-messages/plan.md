# Plan: billing-day-count-messages

Input: change.md (research and framing skipped, reasons there). Complexity: small (two phases).

## Today (master `d217f9c`)

- `defineModule` in `@softure-ai/core` already takes `messages` beside the options of every module and deep-merges
  them over the module's dictionaries, so `billing({ messages: { pl: { … } } })` works (README "Copy" shows it).
- `getBillingMessages(config)` exists in `@softure-ai/billing/server` (`server/options.ts`) and returns the merged
  copy in `config.locale`, but `/next` does not export it and no test covers an override reaching it. In
  feature-switches the same reader is exported from `/next` (`getFeatureSwitchesMessages`).
- `ui/format.ts`: `formatDay` / `formatLastDay` (`dateStyle: "long"`), `formatDaysLeft` (sentence from
  `badge.daysLeft`), `formatPeriod`. No bare count and no numeric date. No test file targets these functions directly.

## Goal

`@softure-ai/billing` 0.1.10 with all three points of #280.

**Out of scope:** changing `formatDaysLeft` or the badge; a generic date-format option on every component.

## Key decisions

- **`getBillingMessages` in `/next`**: re-export the server function (the adapter already depends on `/server`). It
  stays in `/server` too (an existing export). A test shows a `billing({ messages })` override in both a nested group
  and a plural form reaching it, with the untouched keys kept.
- **`messages.dayCount`**: a top-level plural table, as the issue proposes: en `{count} day` / `{count} days`,
  pl the four forms of `badge.daysLeft` without the verb (`other` is the fractional form). Top-level because it is not badge copy: apps use it in their own sentences.
- **`formatDayCount(days, locale, messages)`**: `formatMessage(selectPlural(locale, days, messages.dayCount), { count })`,
  the same shape as `formatDaysLeft`.
- **Short dates**: `formatShortDay(instant, locale, timezone)` and `formatShortLastDay(end, locale, timezone)`, the
  numeric counterparts of `formatDay` / `formatLastDay` (`day: "2-digit"`, `month: "2-digit"`, `year: "numeric"`):
  `22.11.2026` in pl, `11/22/2026` in en. Both, because a compact badge shows the last day of access, which is
  `formatLastDay`'s rule (an end is the first instant without access).

## Phases

### Phase 1: messages and formatters (TDD)

- `src/messages/en.ts`, `pl.ts`: `dayCount`.
- `src/ui/format.ts`: `formatDayCount`, `formatShortDay`, `formatShortLastDay`; exported from `src/ui/index.ts`.
- `src/next/index.ts`: export `getBillingMessages`.
- Tests `tests/format.test.ts`: `formatDayCount` for 0, 1, 2, 5, 22, 1.5 in pl and en (exact strings); an overridden
  `dayCount` is used; `formatShortDay` in pl and en, in the app's time zone across a UTC midnight;
  `formatShortLastDay` of an end at a local midnight is the day before; `getBillingMessages` (from `/next`) returns an
  override merged over the defaults. Polish expectations are written with `\u` escapes (the language gate exempts
  only `messages/` and `pl/` folders; `tests/price.test.ts` is the precedent).
- Done when: billing tests green.

### Phase 2: docs and version

- README (summary list, a "Formatters" paragraph in "Copy" listing every `/ui` formatter, which the README does
  not document today, and `getBillingMessages`), CHANGELOG `0.1.10`, `package.json`, manifest and `module.json` version.
- Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

- [ ] Phase 1: messages and formatters
- [ ] Phase 2: docs and version
