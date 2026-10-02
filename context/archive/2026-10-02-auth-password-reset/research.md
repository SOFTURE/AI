# Research: auth-password-reset

Input: change.md, backlog-input.md. Depth: medium (security flow). Sources: `modules/auth`
(ID-3, ID-4), `modules/security` (buckets, `subjectKey`), the example app and its e2e harness,
roadmap-engagement EN-4 (the mailing adapter that will plug into the hook), OWASP's Forgot
Password Cheat Sheet (from memory: random token, stored hashed, short expiry, single use, same
answer for every email, no Host header in the link, sessions ended after a reset).

## Current state

- Sessions: 32 random bytes base64url in the cookie, sha256 hex in `auth.sessions`
  (`session-token.ts`). The same shape fits reset tokens.
- `changePassword` hashes outside the transaction and updates conditionally on the verified hash,
  then deletes the user's other sessions in one transaction. A reset follows the same pattern.
- Rate limits: `consumeRateLimit(ctx, { bucket, key })`; buckets must be configured by the app
  (`assertAuthBuckets` names the missing ones); `AUTH_RATE_LIMIT_BUCKETS` is what apps spread.
  Adding buckets there reaches every app that spreads it.
- The example runs `next start` (production mode) under Playwright; the e2e owns its own
  database rows and reads Postgres directly.
- `after()` from `next/server` runs work after the response is sent, also in server actions.

## Answers to the roadmap unknowns

1. **Token TTL default.** 60 minutes (`passwordReset.ttlMinutes`, 5 to 1440). Short enough that a
   leaked mail goes stale soon, long enough for slow mail delivery.
2. **A request while one is pending.** One pending reset per account, enforced by the table
   (`user_id` is the primary key): a new request replaces the token, so only the newest link works.
   Mail bombing one address is bounded by a per-email bucket (`password-reset-account`, 3 per
   15 minutes), counted for every address so it reveals nothing.
3. **Link base URL for multi-host apps.** The link is built on `config.appOrigin` plus the module's
   `resetPassword` route, never on the request's Host header (reset poisoning). The hook receives
   the link as a URL string with `details.expiresAt` and `details.locale`; a multi-host app keeps
   the path and query and swaps the origin in its own sender, from what it knows about the user.
   Documented in the README.

## Decisions

- **Not revealing the account.** The action validates the email's shape and counts both buckets
  synchronously (same for every email), returns the same "check your inbox" state, and issues the
  token and calls the sender in `after()`. Timing and sender failures cannot tell an existing
  account from a missing one. Sender failures are logged without the link.
- **No sender, no feature.** Without `passwordReset.send` the pages answer "not found", the
  actions refuse, and the login form shows no "forgot password" link. There is no default sender
  that logs links in production: `consolePasswordResetSender` refuses to run when
  `NODE_ENV === "production"` (a token in logs is a secret in logs).
- **Single use under concurrency.** The reset deletes the row conditionally
  (`DELETE … WHERE token_hash = $1 AND expires_at > now RETURNING user_id`) in the transaction that
  sets the new hash and ends the sessions, so two parallel submissions cannot both succeed.
- **GET does not consume.** The reset page only checks the token (mail scanners prefetch links);
  the POST consumes it. The page renders `<meta name="referrer" content="same-origin">` so the
  token in the URL never reaches another site through Referer. (Measured in the e2e:
  `no-referrer` makes the browser send `Origin: null` with the plain HTML form, and Next refuses
  the server action.)
- **After a reset.** The form shows a success notice with a link to the login page. No automatic
  sign-in: the reset proves mailbox access, the login proves the new password works.
- **A normal password change also cancels a pending reset** (an attacker's pending link should not
  outlive the owner's change).
- **Pruning.** `prunePasswordResets(ctx)` for a scheduled job, like `pruneSessions`; the
  one-row-per-user key keeps the table small without it.

## Risks

- Token in the query string lands in access logs of the app's own proxies: accepted (single use,
  60 minutes), documented.
- The e2e needs the link the server "sent": the example app's sender appends to an outbox file
  when `PASSWORD_RESET_OUTBOX` is set (Playwright sets it for `next start`), else uses the console
  sender. The file is test plumbing of the example only.
