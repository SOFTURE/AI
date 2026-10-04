# Research: waitlist-funnel-hook

Sources: `modules/waitlist` (`server/signups.ts`, `server/confirmation-mail.ts`, `next/actions.ts`,
`next/confirm-page.tsx`, options, README §3, §10, §12), `modules/auth` (`server/register.ts`,
`OnRegisteredHook`), `modules/analytics` (`next/channel.ts` `countRegistration`,
`server/funnel.ts`, `server/channel.ts`, README §10, §12), the example app (`softure.config.ts`,
`e2e/analytics-funnel.spec.ts`, `e2e/waitlist.spec.ts`), FU-7's open branch (`tagRedirect`,
auth's `rewriteRedirect`).

## Summary

Add `waitlist({ onJoined })`: a function `(event, ctx) => Promise<void> | void` called inside the
sign-up's transaction when a sign-up **counts for the first time** (a new sign-up applied at once,
an earlier unconfirmed row applied without double opt-in, or the first use of a confirmation link).
Errors propagate and roll the sign-up back, as with auth's `onRegistered`; a counter that must not
refuse sign-ups catches its own errors. Analytics gets a generic `countFunnelStep(step)` hook that
fits any module's server event (`countRegistration` becomes a thin alias). With double opt-in the
channel is lost on the mail hop, so the waitlist offers `rewriteConfirmationLink` (the same shape
as FU-7's `rewriteRedirect`): the app adds the channel tag to the link, the confirmation page keeps
it, and the confirm action's `getChannel()` reads it from the page's `Referer`.

## Unknowns answered

1. **Repeat sign-ups that only widen scopes:** no call. A funnel step is "a person joined", which
   happens once per address; a widening is a consent change the ledger already records. The event
   carries `via` (`join` | `confirmation`) for apps that care how it counted. An app that wants
   every request keeps reading `joinWaitlist`'s result.
2. **Context:** the hook gets the waitlist context with `db` set to the sign-up's transaction
   (`ModuleContext<Queryable>`), the same as auth's hook, so `recordFunnelStep` writes atomically
   with the sign-up.
3. **Failure policy:** a thrown error rolls the sign-up back and the action answers the generic
   error (`safeError`), as for auth. `countFunnelStep` runs in a savepoint and only logs, so the
   analytics side never refuses a sign-up.

## Channel through double opt-in

- The join is a server action posted from the tagged page: `getChannel()` (Referer) reads the tag.
- The confirmation runs in `confirmSignupAction`, posted from the confirm page. That page sets
  `<meta name="referrer" content="same-origin">`, so the action's Referer is the confirm page URL.
  If the link carries `?z=`, `getChannel()` reads it; today it never does.
- The link is built in `deliverConfirmationMail` (`getConfirmationLink`), which the join action runs
  inside `after()`. Next allows `headers()` inside `after()` in server functions, so a rewrite can
  read the join request's Referer there.
- The waitlist must not depend on analytics. A function option that rewrites the link's path
  (`(path, ctx) => string | Promise<string>`) keeps it generic and matches FU-7's
  `rewriteRedirect`, so `tagRedirect` (FU-7) fits it as is once merged. Until then the example app
  writes the three-line rewrite with `getChannel` and `withChannel`.
- Safety: the result must stay a path on the app and keep the token (the link's only job); anything
  else, or a throw, falls back to the module's link with a log line, as auth does for its rewrite.

## Affected surface

- `modules/waitlist/src/options.ts`: `onJoined`, `rewriteConfirmationLink`.
- `modules/waitlist/src/contract.ts`: `WaitlistJoinedEvent`.
- `modules/waitlist/src/server/signups.ts`: call the hook on first count.
- `modules/waitlist/src/server/confirmation-mail.ts`: apply the rewrite.
- `modules/waitlist` exports, README §3, §10, §12; tests in `signups.test.ts`, `confirmation.test.ts`.
- `modules/analytics/src/next/channel.ts`: `countFunnelStep`; README §10, §12.
- Example app: funnel step `waitlist` (`via: "server"`), `onJoined`, the link rewrite;
  `e2e/analytics-funnel.spec.ts` gets a waitlist test.

## Data

No table or migration changes.

## Risks

- A hook that throws refuses sign-ups: documented, the analytics helper never throws.
- A rewrite that drops the token would break confirmations: refused by the check above.
