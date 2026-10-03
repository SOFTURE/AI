# Plan: auth-reset-via-mailing

Input: change.md, research.md. Complexity: low (1 phase).

## Goal

- `@softure-ai/auth/mailing`: `mailingResetSender()` returning a `PasswordResetSender` that renders
  the reset mail from auth's dictionaries in `details.locale` and sends it with mailing's
  `sendMail`; `renderPasswordResetMail(messages, { link, ttlMinutes })` for apps that send it
  themselves.
- Messages `resetMail.*` in en + pl; README sections 3, 4, 9, 10.
- `package.json`: the `./mailing` export, `@softure-ai/mailing` as an optional peer.
- Example: `passwordReset.send: mailingResetSender()`, its own reset sender and
  `PASSWORD_RESET_OUTBOX` removed, `readResetLinks` over the mail outbox,
  `e2e/auth-reset-mail.spec.ts` (request → captured mail → new password → login).

**Out of scope:** mail kinds and suppressions (EN-2), retries and a ledger (EN-3), mail for other
auth events.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Location | `@softure-ai/auth/mailing`, optional peer | roadmap gives auth the wiring; mailing stays auth-agnostic | research 1 |
| Expiry copy | duration from `ttlMinutes` | no reader time zone; same words as the page | research 2 |
| Config | registered config at call time | the sender sits inside the config | research |
| Failure | throw naming the `mailing.*` code | auth already logs sender failures | research |

Rejected: a sender in `modules/mailing` (mailing would import auth types; EN-2 owns that folder);
a clock time in the mail (time zone unknown); passing the address into the copy (less personal
data in mail bodies).

## Phase 1: Adapter, copy, example and e2e

**Discipline:** TDD for the renderer and sender, test-after for the example wiring.

- `src/mailing/index.ts`, `src/mailing/reset-mail.ts`, messages en + pl, `package.json`, lockfile.
- Tests: rendered text and HTML in both locales, escaping, overrides, the sent mail through the
  fake provider (to, subject, text, html, no headers), the thrown error per `mailing.*` code without
  the address or link, `deliverPasswordReset` end to end with the sender.
- Example wiring, `e2e/outbox.ts`, `playwright.config.ts`, `e2e/auth-reset-mail.spec.ts`, README.

## Risks and rollback

- No migration; rollback is reverting the commits.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Adapter, copy, example and e2e

#### Automated
- [ ] 1.1 Unit tests for the renderer and the sender pass
- [ ] 1.2 `npm run e2e` passes against a local PostgreSQL 16, including `auth-reset-mail.spec.ts` and `auth-reset.spec.ts`
- [ ] 1.3 Gates green (typecheck, lint, test, build)
