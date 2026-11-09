---
change_id: guarded-file-download
status: done
---

# Plan: downloadGuardedFile

Input: change.md. Complexity: small.

## Phase 1: shared GET

- `guarded-get.ts`: the redirect loop (`followGuardedRedirects`, with `requireHttps`), `decodeBody`,
  `parseContentType`, `GuardedFetchError`, moved out of `guarded-page.ts`; the page fetch uses them unchanged.

## Phase 2: the download

- `guarded-download.ts` `downloadGuardedFile(url, options, consume, seam?)`: `consume` only for 2xx; a declared
  length over the cap refused up front; the streamed cap and body failures told apart from `consume`'s own errors.
- Exports, README "Downloading a file", CHANGELOG 0.2.7, version 0.2.7.

## Acceptance

- `tests/guarded-download.test.ts` against a loopback server: body and head, headers, non-2xx, redirects, blocked
  hosts, https only (first URL and redirect), too many redirects, declared and streamed caps, compressed cap, unknown
  encoding, a cut body, a stall timeout, `consume` errors propagate, bad header, option ranges, public-only default.
- `tests/guarded-page.test.ts` unchanged and green; `npm run typecheck`, `npm run lint`, security tests green.

## Decisions (auto)

- Callback (`consume`) rather than returning a stream: the time limit and the teardown wrap the whole body read, and
  nothing is left open when the function returns.
- A non-2xx answer is `Ok` with `consumed: false` (status for the caller), like the page fetch returns any status.
- Version 0.2.7 (an additive feature, as 0.2.4 added `fetchGuardedPage`).

## Progress

- [x] Phase 1
- [x] Phase 2
