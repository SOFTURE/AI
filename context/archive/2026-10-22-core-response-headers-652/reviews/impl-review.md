---
change_id: core-response-headers-652
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md, the issue and the package conventions.

- Compatibility: calls without `readHeaders` keep their value type and runtime value; the plain overloads take
  `readHeaders?: undefined`, so a call that passes the option always lands on an overload returning
  `{ body, headers }`. `HttpJsonFailure` is a union narrowed by `error`; the only runtime addition on existing calls is
  `retryAfterSeconds` on 429 and 5xx failures, stated in the CHANGELOG with the test-side migration.
- Security: headers are read by name only from the allow-list; header names are validated as RFC 9110 tokens before
  the request, so a write is never sent when its answer cannot be read. The "no secret in a failure" test now allows
  exactly one extra key, `retryAfterSeconds`, on the two retryable codes; the URL and key checks are unchanged.
- `Retry-After`: delay-seconds digits only; dates need a leading letter (so `Date.parse` does not guess on bare
  numbers), a missing zone is read as GMT (asctime), the delay is rounded up and clamped to 0..86 400 against the
  injected clock. Tested with all three date forms, past dates, caps, malformed values and whitespace.
- `parseLinkHeader`: links are split by their `<...>` structure, so commas inside URLs survive; quoted and token
  `rel`, several relation types, `previous`, letter case and first-wins are tested; garbage gives `{}`.
- Other packages: `modules/connections` has its own form client and does not use `HttpJsonFailure`; nothing else in
  the tree constructs it.
- Docs: core README (section "Response headers" with an example), CHANGELOG `## Unreleased`, jobs README example
  now reads `retryAfterSeconds` from a `requestJson` failure. No version bump: the coordinator releases.

Findings: none blocking. Verdict: approved.
