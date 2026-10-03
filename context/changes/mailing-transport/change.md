---
change_id: mailing-transport
title: "Mail transport with provider adapters: sendMail over a MailProvider, resend() first, a fake provider for tests and the example app"
status: in_progress
roadmap_item: EN-1
branch: claude/en-1-mailing-transport-xyrr0a
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

An app that lists `mailing({ from, replyTo, provider })` in `softure.config.ts` sends one mail to one
recipient with `sendMail(...)` and gets a typed result back: sent (with the provider's message id),
`mailing.invalid_input` (nothing left the process), `mailing.rejected` (the provider refused it;
retrying the same mail will not help) or `mailing.unavailable` (provider down, network, timeout;
retry later). The call never throws for any of those. The provider is an adapter: `resend()` ships
first, `fakeMailProvider()` captures mail in memory or in an outbox file for tests and the example
app. Every mail-sending module of roadmap engagement (unsubscribe, ledger, reset mails, waitlist)
builds on this contract.

## Context

Taken from the queued roadmap entry, kept as [`backlog-input.md`](backlog-input.md). Roadmap:
[`roadmap.md`](../../foundation/roadmap.md) (roadmap `engagement`), item **EN-1**. Outcome, unknowns,
risk and baseline are quoted there. The source is FIRE_TRACKER `src/lib/mail.ts` (read only).

## Constraints

- Exclusively owns: `modules/mailing/` (package scaffold, transport, providers),
  `examples/next-app/e2e/mailing-transport.spec.ts`, the example's test-mail page.
- Shared hot file `examples/next-app/softure.config.ts`: append only this module's entry.
- No migration (EN-2 adds the first one).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` dictionaries.
- No release, tag or publish by the agent; the owner tags releases. FIRE_TRACKER is read-only.

## Notes
