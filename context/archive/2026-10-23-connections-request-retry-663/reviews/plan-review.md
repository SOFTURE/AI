---
change_id: connections-request-retry-663
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the package on master (d530152).

- Scope covers every ask: `forceRefresh` under the same lease and `invalid_grant` handling, the helper for all three
  kinds in `/server` and `/next`, refresh once and retry once, reporting only after the second 401, `connections.*`
  codes for credential failures, and the fake provider rejecting a token.
- Concurrency: reusing a refresh another worker stored is kept for forced calls, and the helper refreshes only while
  the stored token is the refused one, so N parallel 401s cost one refresh.
- Safety: headers passed on as pairs so no `Headers` constructor throws a message with the secret outside
  `requestJson`'s try.
- Compatibility: additive only; `failNext` semantics in the fake unchanged for token and revoke calls.
- Deviation noted: a rejected credential answers `connections.reconnect_required` rather than the raw 401; it is
  terminal either way, and the code is what the issue asks a job to branch on.

Verdict: approved, no changes.
