# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/core`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`core@x.y.z`).

## Unreleased

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
