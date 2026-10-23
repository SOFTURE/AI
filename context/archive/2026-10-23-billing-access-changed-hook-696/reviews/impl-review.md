---
change_id: billing-access-changed-hook-696
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md (phases 1-3) on the branch at a74695f.

- Plan followed: one notifier (`server/access-changed.ts`) called after `transaction()` resolves in
  `recordManualGrant` (three grant functions), `revokeManualGrant`, `extendTrialManually`, `recordPayment`,
  `refundPayment` and `failRefund` (through `runPaymentChange`); the low-level functions stay silent.
- Correctness: refusals, duplicates and unknown payments return before any change and report nothing; the hook
  reads committed data (test reads the account history through the hook's `ctx`). `failRefund` reports `refunded`
  when a kept refund applies after the restore, `granted` when only the restore changed access, nothing otherwise.
- Safety: the log line carries the change kind and `errorLogLabel` only (tested with an error message holding an
  email address); the change's result is returned unchanged.
- Compatibility: additive; `SendAccessRemindersOptions` omits mailing's `onDelivery` and redeclares it with a second
  argument, so one-argument callbacks still type-check; the job handler options inherit it.
- Found in review and fixed: the README now says that a `ctx` whose `db` is the app's own open transaction gets the
  hook before the app commits.
- Gates: typecheck, lint, language, billing tests (690 passed), repository tests.

Verdict: approved.
