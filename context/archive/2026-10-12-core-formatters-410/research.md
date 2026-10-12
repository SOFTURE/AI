---
change_id: core-formatters-410
---

# Research: core-formatters-410

Sources: `foundation/core/src/{format,calendar-day,i18n,config,index}.ts`, `foundation/core/src/messages/*`,
`foundation/core/README.md`, `foundation/core/CHANGELOG.md`, Node 22 ICU output.

- `format.ts` caches `Intl` formatters per locale and options; `formatMoney` already takes `signed`
  (`signDisplay: "exceptZero"`) and never signs zero (#375). `formatPercent` takes basis points and no options, with
  `signDisplay` left at `auto`, so a value that rounds to zero can show `-0%`.
- ICU on Node 22: pl `{ month: "long", year: "numeric" }` gives the standalone, nominative month name; with `day` added, the `month` part of `formatToParts` is the genitive. en writes `October 2026`
  either way. pl percent already has no space (`-0,5%`), but other ICU/CLDR versions and future locales may insert
  one, so `tight` removes whitespace literal parts next to the percent sign.
- `selectPlural(locale, count, forms)` picks `Intl.PluralRules` categories; pl needs `one`, `few`, `many`, `other`.
- `coreMessages` is `{ en, pl }` with only `errors`; adding a `duration` group is additive (`CoreMessages` is
  `typeof en`, and pl must match its shape).
- `defineSoftureConfig` validates with zod and freezes; `isOrigin` checks an exact http(s) origin. No code builds a
  `SoftureConfig` literal outside `defineSoftureConfig` (grep), so a new always-filled field breaks nothing.
- zod ^4 is already a dependency of core, so `calendarDaySchema` is `z.string().refine(isCalendarDay, ...)`.
