---
change_id: core-request-error-body-680
---

# Research

## requestJson today (`foundation/core/src/http-json.ts`)

- After `fetch`, `getStatusFailureCode` maps the status; any failure code cancels the body
  (`response.body?.cancel()`) and returns `responseFailure(code, ...)`, optionally with `headers`.
- Statuses that fail: opaque redirect or 3xx and 401/403 (`http_refused`), 409/412 (`http_conflict`), 429
  (`http_rate_limited`), 5xx (`http_unavailable`), anything else outside 2xx (`http_unexpected_answer`).
- A 2xx body that is not JSON or fails `schema` is `http_unexpected_answer`; a network error or timeout before the
  response is `http_unreachable` (status `null`); a body that breaks off is `http_unreachable` with the status.
- The timeout is one `AbortSignal.timeout` passed to `fetch`; the body read runs under the same signal, so reading
  an error body is bounded by it with no extra code.
- `requestJson` has six overloads (schema or not, read or write, `readHeaders` or not). `connections`' wrapper
  repeats them for its own options and does not accept `errorSchema`; that stays so (out of scope).

## Typing options

- Doubling the overloads to twelve is noisy and doubles `connections`' copy if it ever forwards the option.
- A type parameter `E extends z.ZodType | undefined = undefined` on each overload, with `errorSchema?: E`, infers the
  schema when given and falls back to the default when omitted (no inference candidate). The failure type is then
  `E extends z.ZodType ? HttpJsonErrorBodyFailure<z.output<E>> : HttpJsonFailure`, so existing calls keep
  `HttpJsonFailure` exactly.

## Callers waiting for it (#677)

- `modules/connections/src/server/token-client.ts` reads `error` from a 400/401 OAuth answer (RFC 6749 §5.2) to map
  `invalid_grant` to `reconnect_required`.
- `modules/billing/src/stripe.ts` logs Stripe's `error.type`/`error.code` on a refused checkout.
