---
change_id: testing-fake-fetch-664
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the package on master (d530152).

- Scope covers every ask of the issue: method and URL/`RegExp` routing, in order or repeated, JSON / raw body /
  status / headers / thrown error / delay with `init.signal`, recorded calls with lower-case headers and parsed JSON,
  a loud unmatched call, and `expectAllUsed`.
- Safety: a fake never calls the real `fetch`; the unmatched list closes the gap where calling code catches the
  rejection.
- Compatibility: additive exports only; no new dependency (runtime or peer).
- Tests: build-time refusal of invalid scripts, `RegExp` with the `g` flag answering twice, a `Request` input,
  abort during and before the delay.
- Risk: the type of `fetch` must be assignable to both `typeof fetch` and core's `FetchFunction`; check it with a
  type-level test line.

Verdict: approved, no changes.
