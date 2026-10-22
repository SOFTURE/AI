---
change_id: core-response-headers-652
status: in_progress
---

# Plan: response headers in requestJson (issue #652)

Input: change.md, research.md. Complexity: small (one file, its tests, docs).

## Phase 1: readHeaders, retryAfterSeconds, parseLinkHeader (TDD)

Files: `foundation/core/src/http-json.ts`, `foundation/core/src/index.ts`, `foundation/core/tests/http-json-headers-652.test.ts`,
`foundation/core/tests/http-json.test.ts`.

1. Tests first: `readHeaders` returns `{ body, headers }` with each requested name (case-insensitive lookup, `null`
   when absent) and nothing else; a write's empty answer gives `{ body: undefined, headers }`; a failure with a
   response carries `headers`, one without a response does not; an invalid name throws before anything is sent;
   types: without the option the value is the body, with it the record is keyed by the names.
   `retryAfterSeconds` on 429 and 5xx: delay-seconds, an HTTP date against the clock (rounded up), a past date is 0,
   capped at 86 400, missing or malformed is `null`; other failures do not carry it.
   `parseLinkHeader`: next/prev/first/last, quoted and token `rel`, several rels in one link, `previous`, commas in a
   URL, case-insensitive rel, first occurrence wins, `null`/empty/garbage give `{}`.
2. Implement: overloads with `readHeaders` (`const H extends string`), `clock` option, failure types as a union so
   `retryAfterSeconds` narrows by code, `parseLinkHeader` exported with `LinkHeaderLinks`.
3. Update the existing tests whose expected failures for 429/5xx now include `retryAfterSeconds: null`.

## Phase 2: docs

`foundation/core/README.md` (External JSON APIs), `foundation/core/CHANGELOG.md` `## Unreleased`,
`modules/jobs/README.md` example wired to `requestJson`'s `retryAfterSeconds`.

## Decisions (auto)

- Header record keys are the names as the caller wrote them; lookup is case-insensitive, absent headers are `null`
  (so every requested key exists).
- Failure `headers` only when a response arrived and the option is set; `core.http_unreachable` before a response
  has none.
- `retryAfterSeconds` on every `core.http_rate_limited` and `core.http_unavailable` (all 5xx), cap one day
  (86 400 s), HTTP dates measured against `options.clock` (default `systemClock`), rounded up to whole seconds.
- An invalid header name in `readHeaders` throws a `RangeError` before the request (caller's bug, and a write must
  not be sent when the answer cannot be read).
- `parseLinkHeader` returns URLs as written (no resolution against a base) and accepts `null` so
  `parseLinkHeader(result.value.headers.link)` reads directly.

## Progress

- [ ] Phase 1: readHeaders, retryAfterSeconds, parseLinkHeader
- [ ] Phase 2: docs
