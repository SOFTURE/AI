---
change_id: form-calls-request-json-677
status: archived
---

# Plan: form calls through requestJson (issue #677)

Input: change.md, research.md. Complexity: small (two source files).

## Phase 1: connections token client

Files: `modules/connections/src/server/token-client.ts`, `modules/connections/tests/token-client.test.ts`,
`modules/connections/CHANGELOG.md`.

1. Tests first: a 400 and a 401 OAuth error answer `oauth_error` with the status; a 429 and a 503 with an OAuth
   error body stay `failed` (no `reconnect_required`); a 3xx is `failed`; the form body carries the client id and
   secret (or Basic auth); a revocation answered 204 is true and one answered 400 false.
2. Replace `postForm` with `requestJson({ url, method: "POST", form, headers, fetch, timeoutMs, errorSchema })`.

## Phase 2: billing Stripe checkout

Files: `modules/billing/src/stripe.ts`, `modules/billing/tests/stripe.test.ts`, `modules/billing/CHANGELOG.md`.

1. Tests first: the request still goes out with `cache: "no-store"` and `redirect: "manual"`; a 3xx is refused and
   logged with its status; the existing log assertions hold (type/code, no message, no key).
2. Replace the hand-written `fetch` with `requestJson`, wrapping the injected `fetch` to add `cache: "no-store"`.

## Decisions (auto)

- `requestWithConnection` is not changed: neither call goes through it, and the issue excludes public API changes.
- The core range is raised at release time, not here (research.md, Dependency range).
- The Stripe log names the failure code instead of the thrown error's name; the status stays in the log.
- A Stripe redirect is refused instead of followed (the secret key never reaches another host); a behaviour fix
  noted in the CHANGELOG.

## Progress

- [x] Phase 1: connections token client (67f3985)
- [x] Phase 2: billing Stripe checkout (feb0e8b)

Tests were written before the code: in phase 1 the form assertion failed on the old string body, in phase 2 the
`no-store`/`manual` and the logged-code tests failed.
