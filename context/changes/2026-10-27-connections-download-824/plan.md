---
change_id: connections-download-824
status: open
---

# Plan: binary download with a stored connection (issue #824)

Input: change.md, research.md. Complexity: small (core helper, connections wrapper, docs).

## Phase 1: core `requestBytes` (TDD)

Files: `foundation/core/src/http-bytes.ts` (new), `foundation/core/src/http-json.ts` (share helpers internally),
`foundation/core/src/index.ts`, `foundation/core/src/messages/en.ts`, `foundation/core/tests/http-bytes-824.test.ts`.

1. Tests first: GET answers `{ bytes, contentType }` with the exact bytes; `accept` defaults to `*/*` and the option
   sets it; a JSON `body` with `POST` is sent as JSON; a GET with a body throws before sending; 401/403/3xx, 409, 429
   (with `retryAfterSeconds`), 5xx, 404 map to the same codes as `requestJson`; a network error or timeout is
   `core.http_unreachable` and never quotes the URL; a `Content-Length` above `maxBytes` is `core.http_too_large`
   without reading; a streamed body without length that passes `maxBytes` is refused and cancelled; exactly
   `maxBytes` is accepted; an empty body is an empty array; an invalid `maxBytes` throws a `RangeError`.
2. `requestBytes(options)` with `method` (default GET), JSON `body` (writes only), `idempotencyKey`, `accept`,
   `maxBytes` (default 25 MiB), `timeoutMs`, `fetch`, `headers`, `clock`. Result `Ok<HttpBytesAnswer> |
   HttpBytesFailure`.
3. `core.http_too_large` copy in `messages/en.ts`.

## Phase 2: connections `downloadWithConnection` (TDD)

Files: `modules/connections/src/server/request.ts`, `src/server/index.ts`, `src/next/tokens.ts`, `src/next/index.ts`,
`tests/download-824.test.ts`, `tests/next.test.ts` if it lists exports.

1. Tests first: OAuth sends the token and answers bytes and content type; an early 401 refreshes once and retries
   once; a second 401 reports the credential rejected; API key header placement and Basic; the caller's own
   credential header is replaced; credential failures before the call; other failures pass through; too large passes
   through as `core.http_too_large`.
2. Generalise `sendWithConnection` into one credential path that takes the call (`requestJson` or `requestBytes`);
   `downloadWithConnection(ctx, account, options)` in `/server`, `downloadWithConnection(account, options)` in
   `/next`.

## Phase 3: docs

`modules/connections/README.md`, `modules/connections/CHANGELOG.md` and `foundation/core/CHANGELOG.md` under
`## Unreleased`, core README if it documents `requestJson`.

## Decisions (auto)

- The HTTP rules live in core (`requestBytes`), not in a second copy in connections.
- A body above the cap is `core.http_too_large` (new code, with copy), not `core.http_unexpected_answer`.
- Default cap 25 MiB; `accept` defaults to `*/*` (the caller narrows it, e.g. `application/pdf`).
- No `readHeaders` or `errorSchema` on the binary call: the issue asks for the content type only; they can come later.
- No version bump: connections needs the core release that carries `requestBytes`; the coordinator raises the range.

## Progress

- [ ] Phase 1: core requestBytes
- [ ] Phase 2: downloadWithConnection
- [ ] Phase 3: docs
- [ ] Implementation review
