# Research: auth-waitlist-mail-jobs

## Current state

- **Auth reset.** `forgotPasswordAction` (`modules/auth/src/next/actions.ts`) answers at once and runs
  `deliverPasswordReset(ctx, email)` in `after()`, so neither timing nor failure reveals an account.
  `deliverPasswordReset` (`src/server/password-reset.ts`) looks the user up, `issuePasswordReset` stores the sha256 of
  a fresh 32-byte token (one row per user, upserted), then calls the app's `passwordReset.send(link, user, details)`.
  A thrown sender is only logged. The raw token exists only in memory and in the mail.
- **Waitlist confirmation.** `joinWaitlist` (`src/server/signups.ts`) runs one transaction; with double opt-in,
  `requestConfirmation` writes the sign-up with `pending_scopes`, `confirmation_token_hash` and
  `confirmation_expires_at` (7 days by default, at most 30) and returns the raw token. `joinWaitlistAction` then calls
  `deliverConfirmationMail(ctx, signup, token)` in `after()`; a refused or failed send is logged, never retried.
  `confirmSignup` finds the row by token hash; once confirmed, `pending_scopes` is null and the hash stays (a second
  click answers ok).
- **Jobs** (`modules/jobs`, unreleased, manifest 0.0.0): `enqueueJob(ctx, { queue, payload, dedupKey })` writes
  through the caller's `db` (a transaction works), the queue must be configured in `jobs({ queues })` or it throws;
  handlers are `defineJobHandler({ payload: zod, run })` returning `ok()`, an `Err` (retried with backoff),
  `failJob(code)` or `retryJobLater(code, s)`; a throw is retried and logged with the error. At-least-once.
- **Optional peers.** Auth reaches mailing through a separate entry (`@softure-ai/auth/mailing`) that the app imports
  and plugs into `passwordReset.send`; `dependsOn` marks optional modules with `?`
  (`"mailing": "^0.2.0?"`), and `tests/repo/packages.test.ts` requires every module package in dependencies or peers
  to be in `module.json → dependsOn`. Core checks the range against the configured module's manifest version.

## Findings

1. The handler cannot rebuild a link from stored state: only token hashes are stored, and the issue forbids the
   token in the payload. So the handler issues the token itself, right before sending: auth upserts a new reset row,
   the waitlist rotates `confirmation_token_hash` on a sign-up that is still pending and unexpired. The link is then
   always fresh for the retry window (auth: `ttlMinutes` from the send; waitlist: the join's expiry, days).
2. Ids only: auth's payload is `{ userId }`, the waitlist's `{ signupId }`. A dedup key per id collapses repeated
   requests while one job is pending.
3. A static import of `@softure-ai/jobs` from auth's or the waitlist's core would make jobs mandatory. Following the
   mailing pattern, a `./jobs` entry in each package holds the jobs code (enqueuer and handlers); the core gets an
   injected enqueuer through options.
4. #492's mailing delivery job cannot carry these mails: its payload would have to hold the rendered mail with the
   link (a credential). Rendering at send time in the module's own handler is required by finding 1.
5. Version: jobs is 0.0.0 on master; a `^0.1.0` peer range and `"jobs": "^0.1.0?"` in `dependsOn` match the first
   release. Until jobs 0.1.0 is on master, core refuses a config with both (asked the coordinator to release jobs).
6. Conflicts: #491 touches the prune functions (`prunePasswordResets`, `pruneUnconfirmedSignups`) and probably the
   same `package.json`, `module.json` and CHANGELOG sections; this change stays out of the prune code.
