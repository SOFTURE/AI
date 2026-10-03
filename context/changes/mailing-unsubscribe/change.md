---
change_id: mailing-unsubscribe
title: "Signed one-click unsubscribe and a suppression list: list mail carries RFC 8058 headers and a footer link, sendMail refuses suppressed recipients"
status: in_progress
roadmap_item: EN-2
branch: claude/en-2-mailing-unsubscribe-uerzdo
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A mail sent with a `kind` other than `transactional` is list mail. `sendMail` gives every list mail
an HMAC-signed unsubscribe link (in a footer of the text and HTML bodies) and the RFC 8058
`List-Unsubscribe` / `List-Unsubscribe-Post` headers, and refuses it with `mailing.suppressed` when
the recipient has opted out. The opt-out is recorded in `mailing.suppressions` by a one-click POST
route (mail clients) or by a button on an unsubscribe page (people), both from the Next adapter.
Transactional mail (password resets, account notices) is sent as before. Every later mail-sending
module (ledger and campaigns, waitlist) gets unsubscribe handling by passing a `kind`.

## Context

Taken from the queued roadmap entry, kept as [`backlog-input.md`](backlog-input.md). Roadmap:
[`roadmap.md`](../../foundation/roadmap.md) (roadmap `engagement`), item **EN-2**. Sources:
FIRE_TRACKER `src/lib/unsubscribe-link.ts`, `src/lib/unsubscribe-footer.ts`,
`src/app/api/wypisz/route.ts`, `src/app/wypisz/*`, `src/app/actions/do-unsubscribe.ts` (read only).

## Constraints

- Exclusively owns: `modules/mailing/` unsubscribe code, `modules/mailing/migrations/`
  (suppressions), `examples/next-app/e2e/mailing-unsubscribe.spec.ts`, the example's unsubscribe
  routes and the list-mail option of its test-mail page.
- `examples/next-app/softure.config.ts` stays untouched (mailing is already listed; the secret is an
  environment variable).
- EN-4 runs in parallel and calls `sendMail` for transactional mail: the default kind stays
  `transactional`, and the server `sendMail({ config })` keeps working without a database handle.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` dictionaries.
- No release, tag or publish by the agent; the owner tags releases. FIRE_TRACKER is read-only.

## Notes
