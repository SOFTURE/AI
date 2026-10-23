---
change_id: billing-access-changed-hook-696
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the package on master c9eaf67.

- Scope matches the issue: one optional hook on `billing({ ... })` and a second `onDelivery` argument. The extra
  coverage (provider payments and refunds) follows from "access changed" and costs one call per function.
- Correctness: the hook is called by the public functions after `transaction()` resolves, so it sees committed data;
  the low-level functions that run inside other transactions stay silent (recorded under Decisions).
- Safety: a throwing hook is caught and logged by change kind and error label, never with the account id or the
  error message (an app error may carry personal data); the change's result is returned unchanged.
- Compatibility: additive; one-argument `onDelivery` callbacks keep compiling (a function with fewer parameters is
  assignable).
- Tests: every call site, the no-op paths, commit visibility, the failing hook, the reminder pairing with a custom
  scope and a skipped account.

Verdict: approved, no changes.
