---
change_id: core-request-json-writes-635
reviewed: 2026-10-21
verdict: approved
---

# Plan review: core-request-json-writes-635

Checked plan.md against change.md, research.md, issue #635 and `http-json.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | A method typed as the whole union with a schema would match the GET overload and promise a value that can be `undefined`. | The GET overload takes `method?: "GET"` only; the write overload returns `Ok<z.output<S> \| undefined>`. A type test pins both. |
| 2 | Major | A GET with a body makes `fetch` throw, which would read as `core.http_unreachable`. | The read options type `body` and `idempotencyKey` as `never`. |
| 3 | Minor | Serialising the body inside the try would turn a caller bug (a cycle) into `core.http_unreachable`. | Serialise before the try; the exception propagates. |
| 4 | Minor | Whitespace-only bodies (`"\n"`) from some providers on 200. | An empty answer is a body that is empty after trimming. |
| 5 | Check | A GET's 409 moves from unexpected answer to conflict: a behaviour change for a GET caller that switched on 409's code. | Kept, noted in the CHANGELOG; no existing test or caller in the repo relies on it. |

No Critical findings.
