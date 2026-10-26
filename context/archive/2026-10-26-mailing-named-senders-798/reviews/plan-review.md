---
change_id: mailing-named-senders-798
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the package on master (ba21b05).

- Scope covers every ask of the issue: `senders` in the options validated like `from`, `OutgoingMail.sender` as a
  name only, `invalid_input` with `fields=sender` for an unknown name, `deliverOnce` / `enqueueDelivery` carrying
  it (no code: the mail passes through), the resolved `From` in `previewMail`, and `dns` over every sender domain.
- Safety: the mail can only name a configured sender, so user input can at worst pick one of the app's own
  senders, which the app controls when it builds the mail; the log keeps field names only.
- Compatibility: both new fields are optional; `ProviderMessage` is unchanged; one-domain `dns` output is
  unchanged. `ValidMail` gains `sender`, which only affects code that builds a `ValidMail` itself.
- Tests: the unknown-name path is checked on all three entry points (`sendMail`, `previewMail`, `deliverOnce`),
  and the dns host assignment has a failure case.
- Risk: `deliverOnce` with an unknown sender closes the delivery as `rejected` (`invalid_input`) like any invalid
  mail; the plan accepts that, it is a configuration bug.

Verdict: approved, no changes.
