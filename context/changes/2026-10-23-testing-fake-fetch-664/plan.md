---
change_id: testing-fake-fetch-664
status: in_progress
---

# Plan: a scripted fake fetch (issue #664)

Input: change.md, research.md. Complexity: small (one new module in one package, tests, docs).

## Phase 1: fakeFetch (TDD)

Files: `foundation/testing/src/fetch/fake-fetch.ts`, `foundation/testing/src/index.ts`,
`foundation/testing/tests/fake-fetch.test.ts`.

1. Tests first: routing by method (case-insensitive, omitted = any) and exact URL (normalised) or `RegExp`; routes
   answer in order and each once, `repeat: true` keeps answering; JSON answer (body, `content-type`, default 200),
   raw body, status, headers; `throws` rejects with that error; `delayMs` waits and rejects with the signal's reason
   on abort, and an already aborted signal rejects at once; calls recorded with method, URL, lower-case headers, raw
   body and parsed JSON (also from a `Request` input); an unmatched call rejects with method and URL and makes
   `expectAllUsed` throw; `expectAllUsed` lists unused routes and passes when all were used; a body with a null-body
   status or `throws` combined with an answer is refused when the fake is built.
2. `fakeFetch(routes)` returns `{ fetch, calls, unmatched, expectAllUsed }`; types `FakeFetchRoute`,
   `FakeFetchCall`, `FakeFetch`. Export from the package's main entry.

## Phase 2: docs

`foundation/testing/README.md` (a "Fake fetch" section and API rows), `foundation/testing/CHANGELOG.md`
`## Unreleased`, the package description in `package.json`.

## Decisions (auto)

- Placed in `@softure-ai/testing` (main entry): testing has no dependency on core, so no cycle, and it is where test
  tools live.
- Plain errors instead of Vitest assertions: no runtime dependency on an optional peer.
- Each route is an answer used once unless `repeat: true`; for a call the first matching route that still has an
  answer wins, so routes with the same URL answer in the listed order. A repeated route counts as used after one
  call.
- An unmatched call rejects (like a network failure) and is also kept in `unmatched`, so `expectAllUsed` fails the
  test even when the code under test swallowed the rejection.
- The answer is a discriminated union: `json`, `body` or `throws`, never two of them.

## Progress

- [ ] Phase 1: fakeFetch
- [ ] Phase 2: docs
