# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/core`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`core@x.y.z`).

## 0.1.8

- Request origins (#311): `readRequestHost`, `readRequestOrigin`, `readForwardedProto`, `parseOrigin`,
  `getTrustedOrigins` and `resolveAppOrigin(config, request, { trustedOrigins })`, one rule for every module that
  builds an absolute URL for a request (README, "Request origins"). `X-Forwarded-Host` only ever picks a listed origin.
- The config takes `origins: { trustedOrigins, trustRequestHost }` (both optional; defaults `[]` and `false`), read by
  auth, agent-ready, mcp-access and analytics. `SoftureConfig.origins` is always filled by `defineSoftureConfig`.
- Day arithmetic on `YYYY-MM-DD` days with documented semantics: `isCalendarDay`, `addCalendarDays`,
  `addCalendarMonths(day, months, { endOfMonth: "clamp" | "overflow" })` (clamp by default: Jan 31 + 1 month =
  Feb 28/29), `calendarDaysBetween` and `wholeMonthsBetween` (#312).
- Display: `formatCalendarDay(day, locale, "long" | "medium" | "numeric")`, `formatMoney(minor, currency, locale,
  { rounded, signed, compact })` (thousands always grouped, so pl writes `1 234,56`) and `formatPercent(basisPoints,
  locale)`. The pinned ISO 4217 table `CURRENCY_MINOR_UNIT_DIGITS` moves here from billing (#312).

## 0.1.7

- `toCalendarDay(instant, timeZone)` and `getCalendarDay(clock, timeZone)`: the calendar day (`YYYY-MM-DD`) of an
  instant, or today from a `Clock`, in an IANA time zone rather than the process zone (#251).

## 0.1.6

- `PublicError`, `isPublicError` and `getPublicMessage`: a message written for the user passes through, every other error's text stays out (`safeError` is unchanged).
- `selectPlural` builds one `Intl.PluralRules` per locale and reuses it.
- `database: { url, handle }`: the config can carry the app's own database handle, shared with the modules.
- An empty `database.url` is accepted when the config is defined and refused only by a command that connects (build stages need no `DATABASE_URL`).
- A guard against loading the package as CommonJS (ESM only).
