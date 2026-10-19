---
change_id: core-request-json-598
reviewed: 2026-10-19
verdict: approved
---

# Implementation review: core-request-json-598

Checked the diff of `http-json.ts`, `index.ts`, `messages/en.ts`, the new tests, README and CHANGELOG against
change.md and plan.md.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | `new Headers(options.headers)` ran outside the try: an invalid header value (a newline in a key) threw a `TypeError` whose message quotes the value, out of `requestJson`. | Moved inside the try; it returns `core.http_unreachable` and sends nothing. Test added. |
| 2 | Major | A failed status returned without reading the body, so undici kept the connection until garbage collection. | The body is cancelled before the failure returns (a cancel failure is ignored on purpose). Test added. |
| 3 | Check | All 30 first tests failed before the implementation and pass after it; no failure value carries anything but `ok`, `error`, `status`. | No change. |
| 4 | Check | `options.fetch` is called detached (`this` undefined), which a browser's `window.fetch` accepts. | No change. |
| 5 | Check | The schema's issues never leave the function; only the code and status do. | No change. |
| 6 | Check | The new `errors.http_*` keys widen `CoreMessages`; overrides are `DeepPartial`, so no app breaks. | No change. |

No Critical findings.
