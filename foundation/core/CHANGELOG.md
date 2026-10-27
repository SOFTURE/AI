# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/core`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`core@x.y.z`).

## 0.2.7

- `requestText({ url, accept?, maxBytes?, followRedirects?, notFoundAsNull?, headers?, fetch?, timeoutMs?, clock? })`
  (#828) reads a text page (HTML, CSV) with `requestBytes`' rules: the timeout bounds the body too, the same status
  codes and `Retry-After` parsing, the `maxBytes` cap (`core.http_too_large`), no caught error's text. It answers
  `Ok<{ text, url, status, contentType }>` or an `HttpTextFailure` (the `HttpBytesFailure` union). The body is decoded
  with the `charset` of `Content-Type`, UTF-8 otherwise. Redirects stay refused unless `followRedirects: true`, which
  answers the final `url`; `notFoundAsNull: true` answers 404 and 410 as `ok(null)`. `requestBytes` now shares its
  capped body read with it; its behaviour is unchanged.
  - Migrate: nothing. An app with its own `fetch` wrapper for an HTML page can switch to it and drop its status
    mapping and `Retry-After` parsing.

## 0.2.6

- `requestBytes({ url, method?, body?, accept?, maxBytes?, idempotencyKey?, headers?, fetch?, timeoutMs?, clock? })`
  (#824) downloads a binary body (a PDF, an image) with `requestJson`'s rules: the timeout bounds the body too, no
  redirect is followed, the same status codes, no caught error's text. It answers `Ok<{ bytes: Uint8Array,
  contentType: string | null }>` or an `HttpBytesFailure`. The body is read chunk by chunk under `maxBytes` (default
  `DEFAULT_MAX_BYTES`, 25 MiB): a `Content-Length` above it, or a body that grows past it, is the new
  `core.http_too_large` (with the status) and the rest is not read. `accept` sets `Accept` (default `*/*`). New copy:
  `errors.http_too_large`.
  - Migrate: nothing. An app that downloads files with its own `fetch` can switch to it.

## 0.2.5

- The way back from days to instants (#783): `getDayStartInstant(day, timeZone)` returns the first instant of a
  `YYYY-MM-DD` day in an IANA zone, `getLocalDateTimeInstant(value, timeZone)` the instant of a `LocalDateTime`, with
  DST handled (a repeated time gives its first occurrence, a skipped time the instant the same distance after the
  change). Also exported: `getWallClock`, `getZonedInstant`, the `WallClock` type and `isTimeZone`. They moved from
  `@softure-ai/jobs`, which now imports them from core.
  - Migrate: nothing. An app that copied the zoned-time arithmetic (for example to query a calendar API by the
    owner's days) can drop its copy and import these.

## 0.2.4

- `requestJson` reads the body of an error answer through an opt-in `errorSchema` (#680), for OAuth errors
  (`invalid_grant`) and provider error codes. With it, every failure carries `errorBody`: the schema's output for a
  4xx, 429 or 5xx whose body is JSON that passes it, `null` otherwise (an empty, non-JSON or invalid body, a redirect,
  no response, a body that broke off or timed out, a 2xx that failed `schema`). The read is bounded by the call's
  timeout; only the schema's output leaves. New types: `RequestJsonErrorSchemaOptions`, `HttpJsonErrorBodyFailure`,
  `HttpJsonFailureFor`.
  - Migrate: nothing. Without `errorSchema` the body is cancelled as before and the failure type is still
    `HttpJsonFailure`.
- `requestJson` sends form bodies (#676): `form: URLSearchParams | FormData` on a write, exclusive with `body` in the
  types. `URLSearchParams` goes out as `application/x-www-form-urlencoded` (a `Content-Type` the caller sets wins);
  `FormData`, with `Blob` or `File` parts, as `multipart/form-data` with the boundary `fetch` adds, and a
  `Content-Type` the caller sets is dropped. The answer is read as for any write (schema, empty answer
  `ok(undefined)`, status codes, `readHeaders`, `idempotencyKey`, the timeout covering the upload).
  `RequestJsonWriteOptions` is now the union of the new `RequestJsonJsonWriteOptions` and
  `RequestJsonFormWriteOptions`.
- `requestJson` throws a `TypeError` before sending when `body` is a `FormData`, `URLSearchParams`, `Blob`, binary
  buffer or stream (these used to go out as `{}`), when `body` and `form` are both given, when a GET has a `form`, or
  when `form` is neither type.
  - Migrate: nothing for a JSON `body`. A call that passed a form or a file as `body` (and so sent `{}`) passes it as
    `form`. A hand-written form helper (an OAuth token call, a file upload) can move to `requestJson({ method, form })`.
    A type that `extends RequestJsonWriteOptions` extends one of the two new interfaces instead.

## 0.2.3

- `requestJson` reads response headers (#652), with no breaking change to calls that do not use the new option.
  - `readHeaders: readonly string[]`: response headers to return, by name (any letter case), an explicit allow-list.
    With it the value is `{ body, headers }` (each requested name a key, `null` when absent) and a failure that had a
    response carries `headers`. A name that is not a valid header name throws a `RangeError` before the request.
  - `retryAfterSeconds: number | null` on every `core.http_rate_limited` and `core.http_unavailable` failure, parsed
    from `Retry-After` (seconds, or an HTTP date measured against the new `clock` option), 0 to 86 400.
    `HttpJsonFailure` is now a union narrowed by `error`, and a rate limited or unavailable failure's `status` is a
    `number`.
  - `parseLinkHeader(value)` returns the `next`, `prev`, `first` and `last` URLs of a `Link` header.
  - New types `HttpJsonAnswer`, `HttpJsonResponseHeaders`, `HttpJsonRetryableCode`, `LinkHeaderLinks`,
    `RequestJsonReadHeadersOptions`.
  - Migrate: nothing is required. A test that deep-compares a 429 or 5xx failure adds `retryAfterSeconds: null` (or
    the parsed value). An app that dropped to raw `fetch` for `Retry-After`, a `Link` header or rate-limit headers
    goes back to `requestJson` with `readHeaders`, and passes `retryAfterSeconds` to `retryJobLater`.

## 0.2.2

- `requestJson` writes (#635): `method` (`"GET"` by default, `"POST" | "PUT" | "PATCH" | "DELETE"`), `body` sent as
  JSON with `Content-Type: application/json` unless the caller sets its own, and `idempotencyKey` sent as
  `Idempotency-Key`. A write answered with an empty body (204, or 200 with nothing) returns `ok(undefined)`, so a
  write with a schema returns `Ok<T | undefined>`; a non-empty answer still goes through the schema. A GET takes no
  body, and its empty answer stays `core.http_unexpected_answer`. New types `HttpJsonMethod`, `HttpJsonWriteMethod`,
  `RequestJsonReadOptions`, `RequestJsonWriteOptions`.
- New code `core.http_conflict` for 409 and 412 (a stale version or sha), for every method, with English copy in
  `coreMessages` (`errors.http_conflict`).
  - Migrate: a caller that switched on `core.http_unexpected_answer` to spot a 409 or 412 switches on
    `core.http_conflict` instead; an exhaustive `switch` over `HttpJsonFailureCode` gets the new case. An app with
    its own write helper replaces it with `requestJson({ method, body })` and handles `ok(undefined)` for 204s.

## 0.2.1

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
- `requestJson({ url, fetch?, headers?, timeoutMs?, schema? })`: a JSON GET for third-party APIs (#598). A timeout
  (default 10 000 ms), no redirect followed, `Accept: application/json` by default, and every failure returned as an
  `HttpJsonFailure` with a code and the status, never the URL or the error text: `core.http_unreachable`,
  `core.http_refused` (3xx, 401, 403), `core.http_rate_limited` (429), `core.http_unavailable` (5xx),
  `core.http_unexpected_answer` (other status, not JSON, fails the schema). The body is `unknown` without a zod
  `schema` and the schema's output with one. `toQueryString(record)` builds a query string, skipping `null` and
  `undefined`. English copy for the five codes in `coreMessages` (`errors.http_*`).
  - Migrate (optional): an app with its own request helper replaces it with `requestJson`, passes the same headers
    and timeout, moves its response check into `schema`, and maps the five codes to its own codes and messages
    (`result.error`, `result.status`). The helper's own timeout, redirect and error-scrubbing code can go.

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
