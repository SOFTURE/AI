---
change_id: webhook-signature-formats-638
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the package as it is on master (after #636).

- Scope matches the issue: the verifier with algorithm, encoding, prefix and secret lists; the ledger with source,
  delivery id, received at, scheduled pruning through jobs; `recordDeliveryOnce` returning `ok(true)`/`ok(false)`;
  presets in docs without SDKs. Additions (`signWebhookBody`, `forgetDelivery`, retention option) are small and
  close real gaps (testing, losing a delivery when the work fails).
- Correctness: the ledger is one `INSERT … ON CONFLICT DO NOTHING RETURNING`, race-free; the plan tests parallel
  records and a rolled-back transaction. Constant-time comparison is on decoded bytes of the exact digest length.
- Test vectors come from `node:crypto`, independent of the Web Crypto code under test.
- Compatibility: no change to existing functions; the migration is additive; `module.json` and the manifest move
  together (module test).
- Risk: base64 decoding with `atob` throws on bad input; the plan validates the alphabet first and still guards the
  decode. Header names stay the app's choice, so no provider coupling.

Verdict: approved, no changes.
