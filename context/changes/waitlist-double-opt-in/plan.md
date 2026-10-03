# Plan: waitlist-double-opt-in

Input: change.md, research.md. Complexity: medium (2 phases). Risk: medium (consent evidence, a
public link that grants consent).

## Goal

- `waitlist({ doubleOptIn })`: `false` (default), `true`, or `{ expiresInHours }` (1 to 720,
  default 168); parsed to `null | { expiresInHours }`.
- Migration 0002: `confirmed_at`, `pending_scopes`, `confirmation_token_hash` (unique, 64 hex),
  `confirmation_expires_at`; backfill `confirmed_at = created_at`; checks: token and expiry set
  together, pending scopes need a token, an unconfirmed row has pending scopes, `confirmed_at >=
  created_at`; partial index for the prune.
- `joinWaitlist` result becomes a union on `status`: `joined` (`signup`, `isNew`,
  `recordedScopes`, as today) or `confirmation_required` (`signup`, `isNew`, `token`,
  `expiresAt`). The pending path stores the request and a fresh token (a repeat request replaces
  the pending one and the token); no lift, no consent.
- `confirmSignup(ctx, { token, clientKey })`: client bucket, token shape, row lock by hash;
  `waitlist.confirmation_invalid`, `waitlist.confirmation_expired`, or `ok({ signup,
  recordedScopes, isFirstConfirmation })`; a used link answers ok with nothing recorded.
- One "apply" step for an immediate join and a confirmation: lift the own opt-out, scopes (requested
  for an unconfirmed row or after a lift, else widened), record consents, `confirmed_at` kept or set,
  pending request cleared.
- `listSignups` returns confirmed sign-ups only; `WaitlistSignup.confirmedAt`.
  `pruneUnconfirmedSignups(ctx)` returns the deleted count.
- `deliverConfirmationMail(ctx, signup, token)`: transactional mail in the sign-up's locale with the
  link `appOrigin + routes.confirm + ?token=`; `deliverWelcomeMail` skips an unconfirmed sign-up.
- Next: the join action answers `confirmation_sent` and mails the link in `after()`;
  `confirmSignupAction` redirects with `status` (`done`, `invalid`, `expired`, `limited`,
  `failed`), then sends the welcome mail in `after()`; `ConfirmSignupPage` (GET shows a button,
  `referrer` same-origin). Manifest route `confirm: /waitlist/confirm` and its page mount.
- Form: `confirmation_sent` shows `form.confirmationSent`. Messages `en`/`pl`: form line,
  `confirmationMail`, `confirm` page copy. Privacy export gains `confirmedAt` and `pendingScopes`.
- README: options, mounting, tables, copy, hooks, GDPR, limitations (§12 gap closed).
- Example app: `doubleOptIn: true`, `app/waitlist/confirm/page.tsx`; e2e through the link.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| When consents are recorded | at confirmation only | the ledger is insert-only; an unproven consent row is wrong evidence | research, unknown 1 |
| Where the request waits | `pending_scopes` on the sign-up row | one row per address stays; a confirmed row can carry a new request | research |
| Link | random 32 bytes, sha256 stored | no new secret, single-use, expirable (auth precedent) | research, link design |
| Expiry | 7 days default, configurable; prune for a job | the roadmap's "configurable default" | research, unknown 2 |
| Confirmation mail kind | transactional | must reach a re-joining address that opted out | research, risks |
| GET on the link | changes nothing; a button posts | mail scanners open links (mailing precedent) | research |
| Welcome mail with the option | after the confirmation | list mail goes to confirmed sign-ups only | outcome |
| Repeat request on an unconfirmed row | replaces the pending scopes and the token | the latest form is what the link confirms | research |
| Example app | option on | e2e covers the confirmed path; units cover the off path | change.md |

Rejected: recording consents at sign-up with a later "confirmed" flag (needs a ledger state privacy
does not have); an HMAC link (a new secret for a single-use value); confirming on GET (scanners).

## Phase 1: Module

**Discipline:** TDD.

- Options, migration, schema, contract; `signups.ts` (pending path, apply step, `confirmSignup`,
  `listSignups`, prune); `confirmation-mail.ts`; welcome mail guard; privacy export; messages.
- Next: join action, confirm action, `ConfirmSignupPage`, manifest and `module.json`; form state.
- Tests: `options`, `signups` (both paths), new `confirmation.test.ts`, welcome and confirmation
  mail, privacy export, form, messages parity, module manifest.
- README.

## Phase 2: Example app and e2e

- Config `doubleOptIn: true`; mount the confirmation page.
- `e2e/waitlist.spec.ts`: pending sign-up records nothing; confirming records, counts and sends the
  welcome mail; unsubscribe and re-join (lift only after the link); `e2e/migrations.spec.ts` line.

## Risks and rollback

Migration 0002 rollback: drop the four columns, the constraints and the index, then `DELETE FROM
softure.migrations WHERE module = 'waitlist' AND version = 2`; revert the commits. Rows that
were unconfirmed at rollback would count as sign-ups without consent rows: delete them first
(`DELETE FROM waitlist.signups WHERE confirmed_at IS NULL`).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Module

#### Automated
- [ ] 1.1 Waitlist tests for the option, the pending join, the confirmation, the prune and the mails pass
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: Example app and e2e

#### Automated
- [ ] 2.1 Gates green (typecheck, lint, test, build)
- [ ] 2.2 `npm run e2e` passes, including the changed tests in `e2e/waitlist.spec.ts`

#### Manual
- [ ] 2.3 Impl review recorded in `reviews/impl-review.md`
