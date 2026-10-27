---
change_id: core-request-text-828
---

# Research

## What exists

- `foundation/core/src/http-json.ts`: `requestJson`, plus internal helpers shared with `requestBytes`:
  `getStatusFailureCode`, `responseFailure` (parses `Retry-After` through the clock), `httpFailure`,
  `DEFAULT_TIMEOUT_MS`, `RequestJsonOptions` (`url`, `fetch`, `headers`, `timeoutMs`, `clock`).
- `foundation/core/src/http-bytes.ts` (#824, core 0.2.6): `requestBytes` with `maxBytes` (default 25 MiB), a
  `Content-Length` pre-check and a chunked read that cancels past the cap (`core.http_too_large` with the status), and
  `core.http_unreachable` when the body breaks off. The cap logic is inline in `requestBytes`, so a text call would copy
  it unless it is extracted.
- Both calls send `redirect: "manual"`: a redirect is `core.http_refused`, so a key in a header or URL never reaches
  another host. `requestBytes` answers no final URL.
- `messages/en.ts` already has copy for every code, `http_too_large` included.

## What the issue asks

`requestText({ url, fetch?, headers?, timeoutMs?, clock?, maxBytes? })` answering `Ok<{ text, url, status }>` or the
same failure union, optionally `notFoundAsNull: true`; redirect following and the final URL.

## Findings

- Redirects: following them by default would break the rule both calls keep (credentials never reach another host).
  A public page is the main use, so an opt-in `followRedirects: true` covers it; the final URL is `response.url`
  (empty for a constructed `Response`, then the requested URL).
- `fetch` with `redirect: "follow"` throws on a loop or more than 20 hops, which maps to `core.http_unreachable`.
- Decoding: `TextDecoder` accepts the `charset` label of `Content-Type` and throws `RangeError` for an unknown one;
  UTF-8 is the fallback. A BOM is stripped by default.
- `notFoundAsNull` changes the value type, so overloads keep `null` out of the type when the flag is not set.
