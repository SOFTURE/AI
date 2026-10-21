---
change_id: guarded-page-fetch-636
status: archived
---

# Plan: fetchGuardedPage and htmlToReadableText (issue #636)

Input: change.md, research.md. Complexity: medium (one package: two functions, a refactor, tests, docs).

## Phase 1: the shared guard and fetchGuardedPage (TDD)

Files: `modules/security/src/server/guarded-request.ts`, `modules/security/src/server/guarded-page.ts`,
`modules/security/src/server/index.ts`, `modules/security/src/contract.ts`, `modules/security/src/messages/en.ts`,
`modules/security/tests/guarded-page.test.ts`.

1. Tests first, against a fake loopback server with the seam: a 200 page with body, content type and charset;
   `accept` and `user-agent` sent; a redirect chain followed (relative `Location`, `finalUrl`), each hop's host
   resolved through the guard; a redirect to a non-public literal or host is `security.outbound_blocked`, to
   another scheme `security.outbound_invalid_url`; more than `maxRedirects` hops `security.outbound_failed`; a body
   over `maxBytes` truncated (`truncated: true`, exactly `maxBytes`) or `security.outbound_too_large` with
   `allowTruncation: false`; gzip and brotli decoded and capped after decoding; charset from `<meta>` when the
   header has none; a slow body times out; non-2xx returned as `Ok` with its status; option range errors.
2. Refactor `guarded-request.ts`: `checkGuardedUrl(url, allowedPorts, isAllowedAddress)` and
   `openGuardedRequest(target, options, seam)` shared by both functions; `sendGuardedRequest` unchanged outside.
3. `fetchGuardedPage(url, { timeoutMs, maxBytes, maxRedirects = 5, accept, userAgent, allowedPorts = [80, 443],
   allowTruncation = true }, seam?)`. New code `security.outbound_too_large` with English copy.

## Phase 2: htmlToReadableText (TDD)

Files: `modules/security/src/server/readable-text.ts`, `modules/security/tests/readable-text.test.ts`,
`modules/security/tests/fixtures/*.html`, `modules/security/package.json` (`node-html-parser`).

1. Fixtures modelled on real pages: a news article (header, nav, article, aside, footer, scripts), a video page
   (mostly scripts, metadata in `og:*`), a repository page (file list plus a rendered README).
2. Tests: title (`<title>`, then `og:title`, then the first `h1`), description (`meta description`, then
   `og:description`), the main text (`main`, then `article`, then `body`) without scripts, styles, navigation,
   forms or hidden nodes; blocks as paragraphs, list items as `- `; entities decoded; links absolute on `baseUrl`,
   `http(s)` only, deduplicated, `#` and `javascript:` dropped; empty input.
3. Implementation with `node-html-parser` (already in the lockfile through seo).

## Phase 3: docs

`modules/security/README.md` (a section "Fetching a page", the table, limitations), `modules/security/CHANGELOG.md`
`## Unreleased`.

## Decisions (auto)

- `htmlToReadableText` stays in security (coordinator's brief, no overlap with #635 in core); exported from
  `/server` next to the fetch.
- Redirect loop or too many hops → `security.outbound_failed`: the issue keeps the existing codes; a new code only
  for the size cap (`security.outbound_too_large`).
- `allowTruncation` defaults to `true`: a link preview wants the head of a long page, not an error.
- Default ports `[80, 443]` for pages; `http:` links are common and the guard holds on any port.
- The result adds `description` to `{ title, text, links }`: a video page has almost no body text, and a link preview
  needs it.
- `charset` is the declared label (header, else `<meta>` in the first 1024 bytes), lowercase, or `null`; decoding
  stays with the caller (`TextDecoder`), so the fetch never guesses.

## Progress

- [x] Phase 1: the shared guard and fetchGuardedPage (5f5e21d)
- [x] Phase 2: htmlToReadableText (5f5e21d)
- [x] Phase 3: docs (5f5e21d)

One commit for the three phases: the tests were written first in each phase, run against the new code, and kept
alongside it. Gates: typecheck, lint (with the language gate), `modules/security` tests (305 passed, the page fetch
five runs in a row).
