---
change_id: connections-request-retry-663
verdict: approved
---

# Implementation review

Reviewed the diff of 2aeff78..5f2c4e9 against plan.md.

- Every plan step is in: `forceRefresh`, `replaceRejectedToken`, `requestWithConnection` in `/server` and `/next`,
  the fake provider's `apiUrl` and `rejectAccessTokens`, README §1 and §4, the testing section and the CHANGELOG
  with migration notes.
- Lease and concurrency: a forced call skips only the freshness check; the "credentials changed" reuse after the
  lease and in `waitForRefresh` is kept, and the wait drops the force once another worker stored a token. Tests
  cover three overlapping forced calls and three overlapping 401s, each with one refresh.
- Found and fixed during review: a forced call on a never-expiring token without a refresh token was marked
  `reconnect_required` (`expired`); now the stored token is answered and the helper reports `rejected`. Test added.
- Secrets: headers are forwarded as pairs, so no `Headers` constructor throws with a key outside `requestJson`'s
  try; no new log lines.
- Typing: the six `requestJson` overloads are reproduced through a variadic interface; a type assertion in the test
  checks a schema write with `readHeaders`.
- Gates: typecheck, lint and the language gate green in the commit hooks; `npm run build` green; connections tests
  143 passed; repository tests green.

Verdict: approved.
