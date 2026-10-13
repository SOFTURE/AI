---
change_id: core-english-formatters
---

# Research: core English formatters (issue #438)

## Current state (master `ad4d912`)

- `foundation/core/src/format.ts`: `formatCalendarMonth(month, locale: Locale, style)` with
  `"long" | "genitive" | "roman"`; `genitive` reads the month part of a day-month-year `Intl` date.
  `formatDuration(months, locale: Locale)` reads `coreMessages[locale].duration` and `selectPlural`.
- `foundation/core/src/messages/{en,pl}.ts`: the `duration` group, with `few` / `many` forms that only matter for a
  non-English grammar.
- `foundation/core/src/i18n.ts`: `selectPlural(locale: Locale, ...)` caches `Intl.PluralRules` per locale.
- Doc comments in `format.ts` and the README describe a non-English output as reference behaviour.

## Callers

`grep -rn "formatDuration\|formatCalendarMonth" modules tools foundation examples` finds only core's own sources,
tests and README. `selectPlural` is also called by `modules/auth/src/mailing/reset-mail.ts` and
`modules/billing/src/ui/format.ts` with a `Locale`, which stays valid under `string`.

## Options for "an app's own translation"

1. Positional `formatDuration(months, locale, messages?)`: shortest, but `formatDuration(n, "de")` silently writes
   English words with German rules.
2. Options object `{ locale, messages }`: one shape, explicit, the default is plain English. Chosen.
3. A registry (`registerDurationMessages(locale, messages)`): global mutable state, harder to test. Rejected.

## Risks

- Breaking for callers of `"genitive"` and `formatDuration(n, locale)`; core 0.1.11 shipped a day ago and has no
  callers in the repository. The CHANGELOG marks it.
