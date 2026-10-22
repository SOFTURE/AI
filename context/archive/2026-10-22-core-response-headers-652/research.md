---
change_id: core-response-headers-652
---

# Research: response headers in requestJson

## What the package has

- `foundation/core/src/http-json.ts`: `requestJson` with three overloads (GET with schema, write with schema, no
  schema). Failures are `HttpJsonFailure = Err<code> & { status }`; `getStatusFailure` maps statuses to codes and
  the body of a failed status is cancelled. Errors never carry the URL or caught error text; a test asserts the
  failure keys are exactly `error`, `ok`, `status`.
- `Clock` / `systemClock` in `src/clock.ts`; other core helpers take a clock for anything time-dependent.
- `@softure-ai/jobs`: `retryJobLater(code, seconds)` clamps to 0..7 days; its README example reads
  `reply.retryAfterSeconds`.

## Header formats

- `Retry-After` (RFC 9110 §10.2.3): either delay-seconds (`1*DIGIT`) or an HTTP-date (IMF-fixdate; obsolete RFC 850
  and asctime forms must be accepted). `Date.parse` in V8 reads all three. A date in the past means "now" (0).
- `Link` (RFC 8288): `<uri-reference>; param=value; ...`, comma separated; `rel` may be quoted or a token and may
  hold several space-separated relation types, case-insensitive. `previous` is a registered synonym of `prev`.
  A URI may itself contain a comma, so links are split by the `<...>` structure, not by commas.
- Header names are case-insensitive; `Headers.get` handles that and throws a `TypeError` on an invalid name.

## Findings

- A 503 is the usual carrier of `Retry-After` among 5xx, but proxies send it with 502 and 504 too; reading it on
  every `core.http_unavailable` costs nothing.
- Callers type the names they read; a `const` type parameter lets the returned record be keyed by those names.
