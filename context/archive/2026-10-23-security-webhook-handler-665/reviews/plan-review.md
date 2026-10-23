---
change_id: security-webhook-handler-665
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, the issue's scoping comment and the package on master (d530152).

- Scope matches the scoping comment: `handleWebhook` in `/server`, presets as constants, a test helper over
  `signWebhookBody`, the README example on the helper. The route wrapper is folded into `handleWebhook` itself
  (it already has the route signature); recorded under Decisions, smaller than the issue's sketch on purpose.
- Security: the order is fixed in code (nothing parsed before the signature verifies, nothing recorded before the
  event validates); answers are codes only; the log carries the error message, never the body or the secret.
- Correctness: `recordDeliveryOnce` and `handle` share one transaction, so a failing `handle` leaves no record;
  a replay is detected inside the transaction, so two parallel retries run the work once.
- Compatibility: additive only; two new codes need messages in an app's own translation (CHANGELOG says so).
- Tests: every answer code, the rollback, the replay, the id from the event, the configuration bug; on PGlite.

Verdict: approved, no changes.
