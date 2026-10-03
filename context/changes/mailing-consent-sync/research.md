# Research: mailing-consent-sync

Sources: `modules/mailing` (suppressions, unsubscribe page action, one-click route, options),
`modules/privacy` (consent ledger, `ConsentSubject`), `modules/waitlist` (join, scopes),
`modules/auth` (`onRegistered`: the precedent for a module hook the app wires), the example app's
`softure.config.ts` and `e2e/waitlist.spec.ts`, archive `2026-10-03-waitlist` (plan review S1).

## Summary

Mailing gets an `onUnsubscribed` option, called in the suppression's transaction; waitlist ships
the handler that withdraws its scopes, and lifts the recipient's own opt-out when someone signs up.
Privacy accepts a subject by email key, because the unsubscribe link never carries the address.

## Current state

- `unsubscribe(ctx, token, source)` verifies the signed link, then inserts
  `mailing.suppressions(recipient_key, source, created_at)` with `ON CONFLICT DO NOTHING`. Sources:
  `one-click`, `page`, `operator` (`suppressRecipient`, for bounces and scripts).
- The link holds only `recipientKey` = base64url SHA-256 of the trimmed, lowercased address.
  Privacy's `getEmailKey` is the same function; the waitlist e2e already relies on that.
- `ConsentSubject` is `{ userId } | { email }`; the ledger stores `email_key`, never the address.
- Mailing depends on nothing; waitlist depends on security, mailing and privacy.
- Auth's `onRegistered(event, txCtx)` is an option the app wires in `softure.config.ts`, called in
  the account's transaction. The example app composes several handlers in one function.

## Affected surface

- mailing: `options.ts` (hook), `contract.ts` (event and hook types), `server/suppressions.ts`
  (transaction, hook call, `liftSuppression`), README §10 and §12.
- privacy: `contract.ts` (`{ emailKey }` subject), `server/consents.ts` (subject columns), README.
- waitlist: `server/signups.ts` (lift in the join transaction), a new
  `server/unsubscribe.ts` (`withdrawWaitlistConsents`), README §10 to §12.
- Example app: `mailing({ onUnsubscribed })`, `e2e/waitlist.spec.ts`.

## Data

No migration. The lift is a `DELETE` on `mailing.suppressions` (the app role has DML). Withdrawals
are new ledger rows (`granted = false`), as the ledger only inserts.

## Tests

PGlite unit tests per module (`modules/*/tests/support.ts`), Playwright e2e on PostgreSQL.

## Patterns to follow

Hook option validated with `z.custom` (auth `onRegistered`); errors as `Result`, database errors
propagate; one transaction for a write that depends on a read.

## Prior work

EN-5 plan review S1 deferred this ("needs a hook in mailing").

## SOFTURE modules

All three are SOFTURE modules; nothing generic to add.

## Risks

- A throwing hook fails the unsubscribe (rolled back, 500 or the page's "failed" state, the client
  retries). Accepted: committing the opt-out without the withdrawal recreates the gap this closes.
- Lifting at sign-up without double opt-in lets anyone who types an address undo that address's
  opt-out (bounded by the `waitlist-email` bucket, 3 per hour). FU-2 moves the lift to the
  confirmation; noted in its backlog entry.

## Relevant lessons

L-002 (Next imports without `.js`) does not apply to `/server` files.

## Answers to unknowns

1. **Who maps a mail kind to a consent purpose?** Nobody needs to: the suppression is global across
   list kinds and the link carries no kind, so an unsubscribe withdraws every mail consent the
   recipient gave. The module that recorded those consents owns the list of purposes: waitlist
   withdraws its declared scopes (`withdrawWaitlistConsents`). Mailing only announces the event;
   the app composes handlers, as with `onRegistered`.
2. **Fresh consent row in the same transaction as the lift?** Yes: `joinWaitlist` already records
   every scope the ledger does not grant in its transaction; the lift joins that transaction, so
   the ledger and the suppression list change together.
   Only the recipient's own opt-outs (`page`, `one-click`) are lifted; an `operator` row (bounce,
   complaint, script) stays.

## Open questions

None.

## Decisions (auto)

- Withdrawal source `unsubscribe`; withdrawn only for purposes whose latest record is granted
  (idempotent on a second unsubscribe).
- The hook runs on every verified unsubscribe, also when the suppression already existed, so a
  retried one-click heals a ledger that missed the first one.
