---
change_id: mailing-named-senders-798
verdict: approved
---

# Implementation review

Reviewed the diff of 9b8b077, 94cb11b and 656446f against plan.md and the issue.

- Every ask is covered: `mailing({ senders })` validated like `from`; `OutgoingMail.sender` as a name only, checked
  for shape in `validateMail` and against the config in `resolveSender`; an unknown name is `invalid_input` with
  `fields=sender` on `sendMail`, `sendMailUnchecked`, `previewMail` and in the `runDeliveries` dry run
  (`forecastDelivery`); `deliverOnce` and queued deliveries carry it with the mail; `previewMail` shows the resolved
  `From`; `softure-mail dns` checks every sender domain.
- Safety: `Object.hasOwn` keeps names such as `constructor` from resolving through the prototype (tested); the log
  line stays field names only; a mail can never carry an address as its sender.
- Compatibility: both fields are optional; a mail without `sender` produces the same `ProviderMessage`; one-domain
  `dns` output is unchanged and all existing dns tests pass untouched. `ValidMail.sender` is new (CHANGELOG).
- Tests: 15 cases in `tests/senders.test.ts`, 5 in `tests/cli.test.ts` (one domain shared, two domains with hosts
  assigned, a failing second domain, a host under no domain, `--domain` alone).
- Fixed in review: the header comment of `send-mail.ts` reflowed to the file's width.
- Noted, not changed: queued deliveries are covered through `deliverOnce` (the jobs handler calls it with the mail
  `buildMail` returns) rather than a separate jobs test; no code in the jobs adapter touches the mail's fields.

Verdict: approved.
