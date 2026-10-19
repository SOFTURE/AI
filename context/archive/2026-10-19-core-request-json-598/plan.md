---
change_id: core-request-json-598
status: archived
---

# Plan: requestJson and toQueryString in core (issue #598)

Input: change.md, research.md. Complexity: small (one new file, tests, copy, docs).

## Phase 1: requestJson and toQueryString (TDD)

Files: `foundation/core/src/http-json.ts`, `foundation/core/src/index.ts`, `foundation/core/src/messages/en.ts`,
`foundation/core/tests/http-json.test.ts`.

1. Tests first, with a fake `fetch` built per test:
   - 200 with a JSON body → `Ok` with the body; with a schema → parsed value; schema failure → unexpected_answer 200;
   - the request: GET, `redirect: "manual"`, an `AbortSignal`, `Accept: application/json` by default and kept when
     the caller sets its own, the caller's headers passed through;
   - 301/302 and an opaque redirect (status 0) → refused; 401, 403 → refused; 429 → rate_limited; 500, 503 →
     unavailable; 404 → unexpected_answer with status;
   - a non-JSON body and an empty body → unexpected_answer;
   - a rejected fetch (TypeError quoting the URL) → unreachable, status null; a timeout (real `AbortSignal.timeout`
     against a fetch that waits for the abort) → unreachable; a body read that rejects → unreachable;
   - no failure, serialised with `JSON.stringify`, contains the URL, the API key in the query or a header value;
   - `toQueryString`: encoding, numbers and booleans, `null`/`undefined` skipped, empty record → `""`.
2. `http-json.ts`: `requestJson`, `toQueryString`, `HttpJsonFailure`, `HttpJsonFailureCode`, `RequestJsonOptions`;
   overloads for with and without a schema.
3. Export from `index.ts`; English copy for the five codes in `messages/en.ts`.

## Phase 2: docs

`foundation/core/README.md` (a subsection under Copy/errors next to `safeError`), `CHANGELOG.md` `## Unreleased` with
the migration for an app that has its own helper.

## Progress

- [x] Phase 1: requestJson and toQueryString (30 tests written first and failing; 344 core tests pass; f513307)
- [x] Phase 2: docs (README "External JSON APIs" next to `safeError`, CHANGELOG `## Unreleased` with the migration)
