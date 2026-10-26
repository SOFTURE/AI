---
change_id: form-calls-request-json-677
---

# Research

## `requestJson` on master (`foundation/core/src/http-json.ts`)

- `form: URLSearchParams` sets `content-type: application/x-www-form-urlencoded` unless the caller set one; `accept:
  application/json` by default; `redirect: "manual"`; one `AbortSignal.timeout(timeoutMs)` covers the body.
- Without `schema` a write answers `ok(undefined)` for an empty body and `ok(unknown)` for JSON.
- Failures: 3xx/401/403 `http_refused`, 409/412 `http_conflict`, 429 `http_rate_limited`, 5xx `http_unavailable`,
  other non-2xx and a non-JSON 2xx `http_unexpected_answer`, no response `http_unreachable` (status `null`), a body
  that breaks off `http_unreachable` with the status.
- With `errorSchema` every failure carries `errorBody`: the schema's output for a 4xx, 429 or 5xx whose JSON passes
  it, `null` otherwise. A redirect body is never read.

## `connections` token client (`modules/connections/src/server/token-client.ts`)

`postForm` mirrors those rules by hand. Mapping each old outcome onto `requestJson`:

| Answer | Old `postForm` | With `requestJson` |
| --- | --- | --- |
| Network error, timeout | failed, `null` | `http_unreachable`, status `null` → failed |
| 3xx, opaque redirect | failed, status | `http_refused`, `errorBody: null` → failed |
| 429, 5xx | failed, status (body not read) | `errorBody` may be set; must be ignored → failed |
| other 4xx, OAuth JSON error | answered → `oauth_error` | `errorBody` set → `oauth_error` |
| other 4xx, any other body | answered → failed | `errorBody: null` → failed |
| 2xx JSON | answered | `ok(body)` |
| 2xx empty | answered, body `null` | `ok(undefined)` |
| 2xx not JSON, body broke off | failed, status | `http_unexpected_answer` / `http_unreachable` → failed, status |

So the client must not turn a 429/5xx `errorBody` into `oauth_error`; everything else maps one to one. A 200 with
`{"error": …}` (GitHub) is still read from the success body. Revocation is true only for a 2xx JSON or empty
answer, as before.

## `billing` Stripe checkout (`modules/billing/src/stripe.ts`)

- Today: `fetch` with `cache: "no-store"`, its own timeout, and `redirect` left at `follow`; a non-2xx is logged
  with Stripe's `error.type`/`error.code`, a 2xx without an https `url` as `no checkout url`, a thrown error by its
  `name`.
- `requestJson` adds `redirect: "manual"` (a redirect is now refused instead of followed with the secret key) and
  does not pass `cache`. Next.js may cache a server `fetch`; to keep `no-store` the adapter wraps its `fetch`.
- The log keeps the HTTP status (`status` on the failure; `null` for no response) and the error type/code from
  `errorBody`. A thrown error's `name` is replaced by the failure code (`core.http_unreachable`), since `requestJson`
  never surfaces the error.
- Tests read `init.headers` as a plain object; `requestJson` passes a `Headers`, so the tests read it through
  `new Headers(...)`.

## Dependency range

`tests/repo/release-rules.test.ts` and `scripts/release/version.mjs` refuse an internal range the workspace version
does not satisfy, so `^0.2.4` cannot be set while core is 0.2.3. The range moves with the core release (change.md,
Before the next release).
