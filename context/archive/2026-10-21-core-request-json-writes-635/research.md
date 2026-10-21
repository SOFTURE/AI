---
change_id: core-request-json-writes-635
---

# Research: core-request-json-writes-635

## What exists

- `foundation/core/src/http-json.ts` (#598): `requestJson` with a GET, `redirect: "manual"`, `AbortSignal.timeout`,
  `Accept: application/json` by default, the status mapped by `getStatusFailure`, the body read as text and parsed in
  separate tries, overloads with and without a zod schema. Tests in `foundation/core/tests/http-json.test.ts`, one of
  which pins a GET's empty 204 to `core.http_unexpected_answer`.
- Copy in `foundation/core/src/messages/en.ts` under `errors.http_*`; README "External JSON APIs" and CHANGELOG.

## Platform facts

- `fetch` throws a `TypeError` for a GET or HEAD with a body, so the GET path must never pass one; the types forbid it.
- `new Headers()` throws on an invalid value (a newline in `Idempotency-Key`), with a message quoting it: header
  building stays inside the existing try.
- `JSON.stringify(value)` returns `undefined` for `undefined`, so `body: undefined` sends no body.

## Risks

- Other threads of the same batch may edit core's `index.ts`, README or CHANGELOG: line-level conflicts, resolved by
  merging master before the merge.
