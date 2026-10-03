---
change_id: auth-reset-via-mailing
title: "Password reset mails through the mailing module: mailingResetSender() for auth's reset hook, pl and en templates"
status: archived
roadmap_item: EN-4
branch: claude/en-4-auth-reset-via-mailing-y9s3pe
created: 2026-10-03
updated: 2026-10-03
archived_at: 2026-10-03
---

## Intent

An app that enables both `auth` and `mailing` gets password-reset mails without writing a sender:
`auth({ passwordReset: { send: mailingResetSender() } })`. The adapter renders the reset mail
(subject, plain text and HTML) from auth's `pl` / `en` dictionaries in the app's locale, with the
link and how long it works, and sends it through `sendMail` of `@softure-ai/mailing`. It is a
transactional mail: no unsubscribe link, never suppressed. The example app resets a password end
to end through the fake mail provider.

## Context

Taken from the queued roadmap entry, kept as [`backlog-input.md`](backlog-input.md). Roadmap:
[`roadmap.md`](../../foundation/roadmap.md) (roadmap `engagement`), item **EN-4**. The reset hook
comes from identity ID-5 (`passwordReset.send`), the transport from EN-1 (`sendMail`).

## Constraints

- Exclusively owns: the mailing sender adapter for auth reset (`modules/auth/src/mailing/`),
  `examples/next-app/e2e/auth-reset-mail.spec.ts`, the example's reset sender wiring.
- `modules/mailing/` belongs to EN-2 in parallel: this item does not edit it.
- No migration.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

- 2026-10-03: implemented and reviewed in the cloud session on `claude/en-4-auth-reset-via-mailing-y9s3pe`; impl review approve.
