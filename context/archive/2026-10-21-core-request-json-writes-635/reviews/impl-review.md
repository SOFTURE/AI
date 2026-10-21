---
change_id: core-request-json-writes-635
reviewed: 2026-10-21
verdict: approved
---

# Implementation review: core-request-json-writes-635

Checked the diff of `http-json.ts`, `index.ts`, `messages/en.ts`, the tests, README and CHANGELOG against change.md
and plan.md.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The 17 new tests failed before the implementation and pass after it; the full core suite passes. | No change. |
| 2 | Check | The overloads: a GET with a schema is `Ok<T>`, a write with a schema `Ok<T \| undefined>`, a GET with a body does not compile; pinned by a type test (`expectTypeOf`, `@ts-expect-error`). | No change. |
| 3 | Check | The no-secret test now sends the key in the body, the idempotency key and a header, and covers 409 and 412; no failure carries anything but `ok`, `error`, `status`. | No change. |
| 4 | Minor | `JSON.stringify` of a bare function or symbol returns `undefined`, which sends no body instead of throwing. | Kept: such a body is not JSON data; the README says `undefined` sends no body. |
| 5 | Check | Header building, the idempotency key included, stays inside the try, so an invalid key cannot leak through a thrown message. | No change. |
| 6 | Check | A GET's 409 moving to `core.http_conflict` is documented with a migration line. | No change. |

No Critical findings.
