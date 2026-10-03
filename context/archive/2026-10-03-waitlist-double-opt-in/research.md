# Research: waitlist-double-opt-in

Sources: `modules/waitlist` (join, welcome mail, unsubscribe handler, privacy contributor, form,
migration 0001, README §10 to §12), `modules/mailing` (signed unsubscribe link, unsubscribe page and
action, `TRANSACTIONAL_KIND`, `deliverOnce`, `liftSuppression`), `modules/auth` (password reset
tokens, `pruneSessions` and `prunePasswordResets`), `foundation/core` (route overrides in
`defineModule`), the example app's `softure.config.ts` and `e2e/waitlist.spec.ts`, archive
`2026-10-03-mailing-consent-sync` (FU-3).

## Summary

Add an opt-in `doubleOptIn` option. With it on, `joinWaitlist` stores the request as pending on the
sign-up row with the hash of a random single-use token, and the join action mails the link as
transactional mail. A confirmation page (scanner-safe: opening it changes nothing, a button posts)
applies the pending request exactly as an immediate sign-up applies it today: lift the own opt-out,
set the scopes, record the consents, set `confirmed_at`, then send the welcome mail. Consents are
recorded only at confirmation. Unconfirmed sign-ups expire (default 7 days) and a prune function
removes them.

## Current state

- `joinWaitlist(ctx, input)`: client bucket, email shape, scope check, email bucket, then one
  transaction: insert (or lock and widen/replace), `liftSuppression`, `recordConsents`. Returns
  `{ signup, isNew, recordedScopes }`. The answer to the browser is the same for a new and a known
  address; the welcome mail goes out in `after()`.
- `deliverWelcomeMail` sends list mail (kind `waitlist`) once per sign-up via `deliverOnce`; list
  mail to a suppressed address is refused (`mailing.suppressed`).
- `waitlist.signups` has `scopes text[] NOT NULL` (1 to 16 valid ids), `placement`, `locale`,
  `created_at`, `updated_at`; no confirmation state. `listSignups` returns every row.
- Mailing's unsubscribe link is HMAC-signed with `MAILING_UNSUBSCRIBE_SECRET` and domain-separated
  (`softure.mailing.unsubscribe.v1:`); its page does nothing on GET and posts a server action
  (mail scanners open links). Its secret is mailing's, read from mailing's env.
- Auth's reset link carries 32 random bytes; only their sha256 is stored, with an expiry; the row
  goes away when used; `prunePasswordResets(ctx)` is for a scheduled job.
- Module routes declared in the manifest are overridable through `module({ routes })` (core).

## Unknowns

1. **Consents at sign-up and confirmed later, or only at confirmation?** Only at confirmation. The
   ledger is insert-only and has no "pending" state; a row recorded before confirmation would claim
   a consent nobody proved, and undoing an unconfirmed one would need a withdrawal row for a consent
   never given. The requested scopes wait on the sign-up row (`pending_scopes`) and become consent
   rows when the link is used, with the document version in force then.
2. **Expiry of unconfirmed sign-ups:** a configurable default of 7 days
   (`doubleOptIn: { expiresInHours }`, 1 to 720). An expired link answers "expired"; signing up
   again issues a new one. `pruneUnconfirmedSignups(ctx)` (for a scheduled job, like auth's
   prunes) deletes unconfirmed rows whose link expired and drops expired pending requests of
   confirmed rows, so an address that never confirmed does not stay stored.

## Link design

A random 32-byte token in the link, its sha256 in the row (auth's reset precedent), instead of an
HMAC: it needs no new secret, is single-use and expirable, and a stolen row cannot be replayed. The
outcome's "signed link" asks for an unforgeable link; a 256-bit random token stored as a hash gives
that. A used link keeps its hash until the next request replaces it, so opening it again answers
"confirmed" instead of "invalid" (double clicks, mail previews).

## Affected surface

- `migrations/0002_add_confirmation.sql`: `confirmed_at`, `pending_scopes`,
  `confirmation_token_hash` (unique), `confirmation_expires_at`; existing rows confirmed at
  `created_at`; checks tie the columns together.
- `options.ts`: `doubleOptIn`. `schema.ts`, `contract.ts` (`confirmedAt`, new codes, form status).
- `server/signups.ts`: pending path, confirmation (`confirmSignup`), shared "apply" step,
  `listSignups` confirmed only, `pruneUnconfirmedSignups`. `server/confirmation-mail.ts`: the link
  and the transactional mail. `server/welcome-mail.ts`: never to an unconfirmed sign-up.
- `next/`: the join action sends the confirmation mail; a confirm action and `ConfirmSignupPage`.
  `ui/`: the form's "check your inbox" state. Messages `en`/`pl`. Manifest: route `confirm`
  (`/waitlist/confirm`) and the page mount. Privacy export: `confirmedAt`, `pendingScopes`.
- Example app: `doubleOptIn` on, the confirmation page mounted; `e2e/waitlist.spec.ts` goes through
  the link; `e2e/migrations.spec.ts` lists migration 2.

## Risks

- The confirmation mail must reach an address that opted out (re-joining after an unsubscribe is
  FU-3's case), so it is transactional. Anyone can trigger one to any address: bounded by the
  `waitlist-email` bucket (3 per hour per address), the standard trade-off of double opt-in.
- A third party can still create an unconfirmed row for someone's address; it counts nowhere and
  expires. The lift of an opt-out now needs the link, closing FU-3's plan review W2.
- Existing rows: the migration backfills `confirmed_at = created_at`, so turning the option on
  later leaves current sign-ups counted.

## Tests

Unit (`modules/waitlist/tests/`): pending join stores no consent and no lift and returns a token;
confirmation records consents, lifts, sets `confirmed_at`, single use and idempotent, expired,
invalid shapes; repeat requests (unconfirmed and confirmed rows); `listSignups` excludes pending;
prune; welcome mail skipped for unconfirmed; option parsing; migration constraints; action and
page. E2e: sign-up, confirmation mail, link, confirm, welcome mail, unsubscribe, re-join and lift.
