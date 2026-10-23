---
change_id: core-request-form-676
status: archived
---

# Plan: form bodies in requestJson (issue #676)

Input: change.md, research.md. Complexity: small (three packages, one source file each in core and testing).

## Phase 1: core `form` option and body guard (TDD)

Files: `foundation/core/src/http-json.ts`, `foundation/core/src/index.ts`,
`foundation/core/tests/http-json-form-676.test.ts`.

1. Tests first: a `URLSearchParams` form is sent as is with `content-type: application/x-www-form-urlencoded`
   (a caller's own content-type kept); a `FormData` form is sent as is with no `content-type` (a caller's own one
   removed), and a real `Response` built from the sent init parses back to the same fields and file; the answer is
   read as for a JSON write (schema, empty answer `ok(undefined)`, failure codes, `readHeaders`, `idempotencyKey`,
   timeout signal). `body` holding a `FormData`, `URLSearchParams`, `Blob`, `ArrayBuffer`/typed array or stream
   throws a `TypeError` before anything is sent; `body` and `form` together, `form` on a GET, or a `form` that is
   neither type throw too. Types: `form` with `body` and `form` on a GET do not compile.
2. Implement: `RequestJsonWriteOptions` becomes `RequestJsonJsonWriteOptions | RequestJsonFormWriteOptions`, both
   exported; `RequestJsonReadOptions` gets `form?: never`. A `getRequestBody` helper validates and returns
   `{ body, contentType }` before the try.

## Phase 2: fakeFetch records form bodies and connections passes `form` (TDD)

Files: `foundation/testing/src/fetch/fake-fetch.ts`, `foundation/testing/src/index.ts`,
`foundation/testing/tests/fake-fetch.test.ts`, `modules/connections/tests/request.test.ts`.

1. Tests first: a call with a `URLSearchParams` or `FormData` body records `form` as a list of fields
   (`{ kind: "text", name, value }` or `{ kind: "file", name, fileName, type, size }`) in order; a JSON or text body
   records `form: undefined`; a hand-encoded URL-encoded string with the matching content-type is parsed too.
   `requestWithConnection` sends a `form` with the credential, and a retried OAuth call sends the same form again.
2. Implement: `FakeFetchCall.form?: readonly FakeFetchFormField[]`, parsed with `Response.formData()` when the body's
   content type is URL-encoded or multipart.

## Phase 3: docs

`foundation/core/README.md` (External JSON APIs), `foundation/testing/README.md` (fake fetch),
`modules/connections/README.md`, and `## Unreleased` in the three CHANGELOGs.

## Decisions (auto)

- `form` is a separate option, exclusive with `body` in the types and at run time, as the issue proposes.
- A caller's own `content-type` is kept for `URLSearchParams` (a provider may want a charset) and dropped for
  `FormData`, since a hand-set multipart type cannot carry the boundary and the body would be unreadable.
- The guard on `body` throws a `TypeError` (a caller's bug, like a value JSON cannot represent) rather than
  returning a failure code; it covers `FormData`, `URLSearchParams`, `Blob`, `ArrayBuffer`, typed arrays and
  `ReadableStream`.
- `fakeFetch` records form fields in a new `form` field and keeps `body` as the encoded text, so existing assertions
  do not change.
- Moving `postForm` and the Stripe call is left to a follow-up issue: it changes two more packages and the issue
  marks it optional.

## Progress

- [x] Phase 1: core `form` option and body guard (7c88546)
- [x] Phase 2: fakeFetch records form bodies and connections passes `form` (5bcf4ec)
- [x] Phase 3: docs (c8ac85f)
- [x] Implementation review fix: binary file parts in fakeFetch (b64c76d)

Tests were written before the code in phase 1 (13 of 21 failed on the missing option and guard). In phase 2 the
fakeFetch tests and the code were written together; the review's binary-part test was run red on the old code first.
