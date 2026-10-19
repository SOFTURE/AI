# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/core`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`core@x.y.z`).

## Unreleased

- New (#599): calendar periods and local wall-clock date-times next to calendar days.
  - `CalendarPeriod` (`{ from, to }`, both ends included) and `calendarPeriodSchema`, which refuses `to` before
    `from` on the path `["to"]` with `must not come before from`.
  - `isDayInPeriod(day, period)`, `doPeriodsOverlap(a, b)` (one shared day overlaps, adjacent periods do not),
    `countPeriodDays(period)` (1 for a single day).
  - `LocalDateTime`, a branded `YYYY-MM-DDTHH:mm` string with no zone, made by `localDateTimeSchema` or
    `isLocalDateTime(value)`; its day part goes through `isCalendarDay`, so `2026-02-30T10:00` is refused.
    `getLocalDay(value)` returns the day.
  - Migrate: an app that defined its own period or local date-time drops its schema, type and helpers and imports
    these. Check two differences: overlap counts a single shared day, and a period's error sits on `to`. An app
    that typed a local date-time as `string` passes values through `localDateTimeSchema` (or `isLocalDateTime`)
    before using them as `LocalDateTime`.

## 0.2.0

- **Breaking (#446):** English is the only built-in language.
  - `LOCALES` is removed; `Locale` is any BCP 47 tag, `isLocale(value)` says whether a value is a well-formed one,
    `DEFAULT_LOCALE` is `"en"`. `defineSoftureConfig` takes any tag as `locale` and refuses one that is not.
  - `coreMessages` and every module ship `en` only. `Dictionaries<T>` is a complete `en` plus any other locales;
    `MessageOverrides<T>` is keyed by any tag, and `mergeMessages` builds a locale without its own defaults on `en`.
  - New `selectMessages(dictionaries, locale)` (the locale, then its language, then `en`), `pickLocalizedText` and
    `LocalizedText` for an app's per-locale option texts.
  - Migrate: an app that shows Polish keeps its own translation and passes it per module as the overrides for its
    locale, `auth({ messages: { pl: authPl } })`; a key it leaves out reads English. Read a module's copy with
    `selectMessages(module.messages, config.locale)` instead of `module.messages[config.locale]`.
- **Breaking (#438):** core's formatters build in no language besides English.
  - `formatCalendarMonth` drops the `"genitive"` style; `CalendarMonthStyle` is `"long" | "roman"`. A full date's
    month form stays available through `formatCalendarDay`.
  - `formatDuration(months, options?)` takes `{ locale?, messages? }` instead of a locale. Its words default to
    English (`DEFAULT_DURATION_MESSAGES`); an app plugs in its own translation with `messages: DurationMessages` and
    the `locale` whose plural rules pick a form. Migrate `formatDuration(n, "en")` to `formatDuration(n)`.
  - `coreMessages` no longer has the `duration` group.
- `formatCalendarDay`, `formatCalendarMonth`, `formatMoney`, `formatPercent` and `selectPlural` take any BCP 47 locale
  tag, not only `LOCALES` (#438). Exported: `DurationMessages`, `FormatDurationOptions`, `DEFAULT_DURATION_MESSAGES`.
- `formatPercent(basisPoints, locale, { fractionDigits })` prints exactly that many fraction digits (`19.00%`,
  `+3.0%`), an integer from 0 to 20 (otherwise a `RangeError`). A value that rounds to zero at that precision stays
  unsigned (`0.0%`). Without it, nothing changes: at most two digits (#455).

## 0.1.11

- Formatting (#410): `formatCalendarMonth(month, locale, "long" | "genitive" | "roman")` for `YYYY-MM` months
  (`isCalendarMonth`) or days, `formatDuration(months, locale)` ("3 years and 2 months", plural forms from
  `coreMessages`), and `formatPercent(basisPoints, locale, { signed, tight })`. `formatPercent` never puts a minus on
  a value that rounds to zero, as `formatMoney` does.
- `memoizeByContent(fn, { max })`: an LRU cache keyed by the arguments' content, no TTL (#410).
- The config takes `landingOrigin` (optional; `SoftureConfig.landingOrigin` defaults to `appOrigin`), the public
  landing site beside an app on a subdomain (#410).
- `calendarDaySchema`: a zod schema for a `YYYY-MM-DD` calendar day (#410).
- New server-only entry `@softure-ai/core/og`: the OG card font loader the modules share (#414).
  `createOgFontLoader({ root, label?, readFile?, fetchImpl? })` and `loadOgFonts(fonts)` (from the working
  directory) read a `.ttf`, `.otf` or `.woff` path or https URL once and answer `{ ok, fonts }` or `{ ok: false, error }`;
  with `OgFontSource`, `OgFont`, `OgFontWeight`, `OG_FONT_WEIGHTS`. Moved from the blog.

## 0.1.10

- `formatMoney` never puts a minus on zero: a negative zero, or an amount that rounds to zero under `rounded` or
  `compact`, shows as `PLN 0.00` / `PLN 0` instead of `-PLN 0.00` (#375).

## 0.1.9

- Day arithmetic on `YYYY-MM-DD` days with documented semantics: `isCalendarDay`, `addCalendarDays`,
  `addCalendarMonths(day, months, { endOfMonth: "clamp" | "overflow" })` (clamp by default: Jan 31 + 1 month =
  Feb 28/29), `calendarDaysBetween` and `wholeMonthsBetween` (#312).
- Display: `formatCalendarDay(day, locale, "long" | "medium" | "numeric")`, `formatMoney(minor, currency, locale,
  { rounded, signed, compact })` (thousands always grouped, so pl writes `1 234,56`) and `formatPercent(basisPoints,
  locale)`. The pinned ISO 4217 table `CURRENCY_MINOR_UNIT_DIGITS` moves here from billing (#312).

## 0.1.8

- Request origins (#311): `readRequestHost`, `readRequestOrigin`, `readForwardedProto`, `parseOrigin`,
  `getTrustedOrigins` and `resolveAppOrigin(config, request, { trustedOrigins })`, one rule for every module that
  builds an absolute URL for a request (README, "Request origins"). `X-Forwarded-Host` only ever picks a listed origin.
- The config takes `origins: { trustedOrigins, trustRequestHost }` (both optional; defaults `[]` and `false`), read by
  auth, agent-ready, mcp-access and analytics. `SoftureConfig.origins` is always filled by `defineSoftureConfig`.

## 0.1.7

- `toCalendarDay(instant, timeZone)` and `getCalendarDay(clock, timeZone)`: the calendar day (`YYYY-MM-DD`) of an
  instant, or today from a `Clock`, in an IANA time zone rather than the process zone (#251).

## 0.1.6

- `PublicError`, `isPublicError` and `getPublicMessage`: a message written for the user passes through, every other error's text stays out (`safeError` is unchanged).
- `selectPlural` builds one `Intl.PluralRules` per locale and reuses it.
- `database: { url, handle }`: the config can carry the app's own database handle, shared with the modules.
- An empty `database.url` is accepted when the config is defined and refused only by a command that connects (build stages need no `DATABASE_URL`).
- A guard against loading the package as CommonJS (ESM only).
