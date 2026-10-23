---
change_id: testing-fake-fetch-664
verdict: approved
---

# Implementation review

Reviewed the diff of fbc495a and 0209ec2 against plan.md and the issue.

- Every ask is covered: method and exact URL or `RegExp` routing, in order or `repeat`; `json`, `body`, `status`,
  `headers`, `throws` and `delayMs` with the abort signal; recorded calls with upper-case method, lower-case
  headers, text body and parsed JSON; an unmatched call rejects with method and URL and fails `expectAllUsed`.
- Safety: the fake never calls the real `fetch`; scripts that cannot be answered (two answers, a body on 204/205/304,
  a status outside 200 to 599, a negative delay) fail when the fake is built, naming the route.
- One fix applied in review: the delay listened to `init.signal` only, so a `Request` input's signal was checked
  before the call but ignored during the wait. It now uses the same signal for both, with a test.
- Compatibility: additive exports from the main entry; no new runtime or peer dependency.
- Tests: 27 cases in `foundation/testing/tests/fake-fetch.test.ts`, including a type-level check that `api.fetch`
  fits `typeof fetch` and core's `FetchFunction`.
- Gates: typecheck, ESLint (zero warnings), the language gate and the testing tests pass locally.

Verdict: approved.
