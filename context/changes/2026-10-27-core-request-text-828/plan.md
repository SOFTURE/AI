---
change_id: core-request-text-828
status: archived
---

# Plan: a text (HTML) request in core (issue #828)

Input: change.md, research.md. Complexity: small (one helper extracted, one function, docs).

## Phase 1: `requestText` (TDD)

Files: `foundation/core/src/http-bytes.ts` (extract the capped read), `foundation/core/src/http-text.ts` (new),
`foundation/core/src/index.ts`, `foundation/core/tests/http-text-828.test.ts`.

1. Tests first: a GET answers `{ text, url, status, contentType }`; `Accept` defaults to HTML and the option or the
   caller's header wins; the charset of `Content-Type` decodes the body, an unknown one falls back to UTF-8;
   `redirect: "manual"` by default and a 3xx is refused; `followRedirects: true` sends `redirect: "follow"` and answers
   the final URL; 404 and 410 are `core.http_unexpected_answer` by default and `ok(null)` with `notFoundAsNull`
   (other 4xx still fail); 401/403, 429 with `retryAfterSeconds`, 5xx map like `requestJson`; a network error or
   timeout is `core.http_unreachable` and never quotes the URL; a `Content-Length` above `maxBytes` or a streamed body
   past it is `core.http_too_large` and cancelled; an invalid `maxBytes` throws.
2. Move the `maxBytes` check, the `Content-Length` pre-check and the chunked read out of `requestBytes` into internal
   helpers (`assertMaxBytes`, `readCappedBody`, `cancelBody`) that both calls use. `requestBytes` tests stay unchanged.
3. `requestText(options)`: GET only; `accept`, `maxBytes` (default `DEFAULT_MAX_BYTES`), `followRedirects`,
   `notFoundAsNull`, plus `RequestJsonOptions`. Failure type `HttpTextFailure` = `HttpBytesFailure`.

## Phase 2: docs

`foundation/core/README.md` (next to `requestBytes`), `foundation/core/CHANGELOG.md` under `## Unreleased`.

## Decisions (auto)

- Redirects stay refused by default (same rule as `requestJson`); `followRedirects: true` opts in for public pages.
- 404 and 410 become `ok(null)` only with `notFoundAsNull: true`; without it they keep the shared mapping.
- The answer also carries `contentType`, so a caller can tell an HTML page from something else.
- GET only: the issue reads pages; a text write can come later.
- The failure union is `requestBytes`'s (`HttpTextFailure` alias), no new code and no new copy.
- No version bump: the coordinator releases.

## Progress

- [x] Phase 1: requestText, a17abea
- [x] Phase 2: docs, 674ba39
- [x] Implementation review: approved
