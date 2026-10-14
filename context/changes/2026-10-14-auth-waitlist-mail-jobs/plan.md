# Plan: auth-waitlist-mail-jobs

Input: change.md, research.md. Complexity: medium (three phases).

## Goal

With `@softure-ai/jobs` configured, a password reset request and a double opt-in sign-up enqueue a job (ids only) and
the mail goes out from a handler with retry; the request never waits for or fails on the provider. Without an
enqueuer, both paths behave exactly as today.

**Out of scope:** the prune functions (#491), mailing's delivery job (#492), the welcome mail, a release.

## Key decisions

- **Injected enqueuer, jobs code in a `./jobs` entry.** Auth: option `passwordReset.enqueue` of type
  `PasswordResetEnqueuer = (ctx, userId) => Promise<void>`; `@softure-ai/auth/jobs` exports `PASSWORD_RESET_QUEUE`
  (`auth.password-reset`), `enqueuePasswordReset` and `authJobHandlers`. Waitlist: option
  `confirmationMail: { enqueue }` (`ConfirmationMailEnqueuer = (ctx, signupId) => Promise<void>`);
  `@softure-ai/waitlist/jobs` exports `CONFIRMATION_MAIL_QUEUE` (`waitlist.confirmation-mail`),
  `enqueueConfirmationMail` and `waitlistJobHandlers`. Jobs is an optional peer (`^0.1.0`, `"jobs": "^0.1.0?"`).
- **The handler issues the link.** Auth: `sendPasswordReset(ctx, userId)` looks the user up by id, upserts a new reset
  token and calls `send`; a missing user is done (`ok`). Waitlist: `sendConfirmationMail(ctx, signupId)` rotates the
  token hash of a sign-up that is still pending and unexpired and mails the new link; nothing pending is done.
- **Where the enqueue happens.** Auth: `deliverPasswordReset` (still in `after()`, so timing reveals no account)
  enqueues instead of sending and returns `"queued"`; there is no token row in the request any more. Waitlist:
  `requestConfirmation` enqueues inside the join transaction; `PendingSignup.isMailQueued` tells the action not to
  send itself.
- **Outcomes.** Auth handler: a thrown sender is logged by label and returned as `auth.password_reset_send_failed`
  (retried); no `send` configured is `failJob("auth.password_reset_unavailable")`. Waitlist handler:
  `mailing.unavailable`, `mailing.quota_exceeded`, `mailing.provider_refused` are retried; `mailing.rejected`,
  `mailing.suppressed`, `mailing.invalid_input` fail the job.
- **Dedup keys** are the user id and the sign-up id. At-least-once: a retry after a send that was not recorded
  mails a second, fresh link and voids the first; documented.
- Auth options refuse `enqueue` without `send` (reset would be off while jobs pile up).

## Phase 1: Auth

- Option, types, `deliverPasswordReset` queued path, `sendPasswordReset`, `./jobs` entry with handler; package.json
  export and optional peer, `module.json` and manifest `dependsOn`.
- Tests: deliver enqueues one job with `{ userId }` and dedups, sends nothing; running due jobs sends one mail whose
  link resets the password; a deleted user succeeds without a mail; a throwing sender retries and logs no link;
  `enqueue` without `send` is refused; the synchronous path is unchanged.

Done when: `npx vitest run modules/auth` green.

## Phase 2: Waitlist

- Option, types, enqueue in `requestConfirmation`, `isMailQueued`, `sendConfirmationMail`, `./jobs` entry with
  handler, action skips its own mail when queued; package.json, `module.json`, manifest.
- Tests: join enqueues `{ signupId }` in the transaction (a rolled-back join leaves no job); the handler mails a link
  that confirms; the token from the join no longer confirms after the handler ran; a confirmed or expired sign-up
  succeeds without a mail; provider outage retries, rejection fails; the action sends nothing itself when queued.

Done when: `npx vitest run modules/waitlist` green.

## Phase 3: Docs and gates

- READMEs (password reset and double opt-in sections, a "Through jobs" part with the config, the worker handlers and
  the queue), CHANGELOG `Unreleased` entries with the migration steps.

Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Auth

#### Automated
- [ ] 1.1 Reset mail enqueued with `{ userId }` and sent by the `auth.password-reset` handler
- [ ] 1.2 Package tests green

### Phase 2: Waitlist

#### Automated
- [ ] 2.1 Confirmation mail enqueued in the join transaction and sent by the `waitlist.confirmation-mail` handler
- [ ] 2.2 Package tests green

### Phase 3: Docs and gates

#### Automated
- [ ] 3.1 READMEs and CHANGELOGs describe the jobs path and the migration
- [ ] 3.2 Typecheck, lint, test and build green
