---
change_id: core-request-json-writes-635
status: in_progress
---

# Plan: requestJson for write calls (issue #635)

Input: change.md, research.md. Complexity: small (one file, tests, copy, docs).

## Phase 1: write methods, empty answers, conflict (TDD)

Files: `foundation/core/src/http-json.ts`, `foundation/core/src/index.ts`, `foundation/core/src/messages/en.ts`,
`foundation/core/tests/http-json.test.ts`.

1. Tests first:
   - each of POST, PUT, PATCH, DELETE sends that method, the JSON body, `content-type: application/json`,
     `redirect: "manual"` and a signal; the caller's own `content-type` wins; no body means no content type;
   - `idempotencyKey` becomes `Idempotency-Key`; an invalid one is `core.http_unreachable` and nothing is sent;
   - a write answered 204, or 200 with an empty body, is `ok(undefined)`, also with a schema; a non-empty body is
     validated by the schema; a GET's 204 stays an unexpected answer;
   - 409 and 412 are `core.http_conflict` for a write and for a GET;
   - the no-secret check also runs with a body carrying the key, and over a conflict;
   - copy for `errors.http_conflict`.
2. `http-json.ts`: `HttpJsonMethod`, `HttpJsonWriteMethod`, read and write option types, overloads, the body and
   headers, the empty-answer rule, `core.http_conflict` in `getStatusFailure`.
3. Export the new types from `index.ts`; copy in `messages/en.ts`.

## Phase 2: docs

README "External JSON APIs" (writes, the code table), CHANGELOG `## Unreleased` with the migration.

## Progress

- [ ] Phase 1: write methods, empty answers, conflict
- [ ] Phase 2: docs
