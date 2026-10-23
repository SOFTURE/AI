---
change_id: core-request-error-body-680
status: in_progress
---

# Plan: error answer body in requestJson (issue #680)

Input: change.md, research.md. Complexity: small (one source file).

## Phase 1: `errorSchema` option (TDD)

Files: `foundation/core/src/http-json.ts`, `foundation/core/src/index.ts`,
`foundation/core/tests/http-json-error-body-680.test.ts`.

1. Tests first: with `errorSchema`, a 400, 401, 403, 404, 409, 429 and 503 answer carry `errorBody` with the
   schema's output (code, status, `retryAfterSeconds` and `headers` as before); an empty body, a body that is not
   JSON and one that fails the schema give `errorBody: null`; a 3xx or opaque redirect, an unreachable service, a
   body that breaks off, and a 2xx body that fails `schema` give `errorBody: null`; a slow error body hits the
   timeout and still returns the status code with `errorBody: null`; works on a GET and on a form write. Without
   `errorSchema` the body is cancelled and the failure has no `errorBody` key. Types: `errorBody` is the schema's
   output or `null`; calls without the option keep `HttpJsonFailure`.
2. Implement: `RequestJsonErrorSchemaOptions<E>`, `HttpJsonErrorBodyFailure<B>` and `HttpJsonFailureFor<E>`
   exported; a generic `E` on every overload; at run time, when `errorSchema` is set, a failing status that is not a
   redirect reads the body (text, JSON, `safeParse`) instead of cancelling it, and every other failure gets
   `errorBody: null`.

## Phase 2: docs

`foundation/core/README.md` (External JSON APIs) and `## Unreleased` in `foundation/core/CHANGELOG.md`.

## Decisions (auto)

- One generic `E` per overload instead of twelve overloads (research.md, Typing options).
- A body read that fails (broken off, timeout) keeps the status's code and gives `errorBody: null`, as the issue says;
  it is not turned into `http_unreachable`, since the status is what the caller acts on.
- With `errorSchema`, every failure carries the `errorBody` key (`null` when nothing was read), so callers test one
  field instead of `"errorBody" in`.
- `connections`' `requestWithConnection` is left as is; #677 adds forwarding if it needs it.

## Progress

- [ ] Phase 1: `errorSchema` option
- [ ] Phase 2: docs
