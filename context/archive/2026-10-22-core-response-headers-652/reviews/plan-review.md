---
change_id: core-response-headers-652
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and `http-json.ts` on master.

- Scope matches the issue's three asks; `clock` is the only addition, needed to test HTTP dates deterministically
  and in line with core's Clock convention.
- Compatibility: without `readHeaders` the value type and runtime value are unchanged. Failures gain
  `retryAfterSeconds` only on two codes; a deep-equality assertion in an app on those failures sees a new key, which
  the CHANGELOG states. Narrowing by `error` keeps the field typed without optional bags.
- Security: only allow-listed names are read; `retryAfterSeconds` is a number. The existing "no secret in a
  failure" test is extended, not loosened.
- Edge cases covered: past dates, huge values, malformed values, rels in several forms, commas inside URLs.

Verdict: approved, no changes.
