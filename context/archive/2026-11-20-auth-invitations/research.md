# Research: auth-invitations

## What exists

- `server/register.ts`: `registerUser` refuses while `isRegistrationClosed`, then validates, counts `register`, hashes
  and inserts the user, runs `onRegistered` and opens a session in one transaction.
- `server/password-reset.ts`: the token pattern to copy. 32 random bytes from `createSessionToken`, only the sha256
  stored (`hashSessionToken`), a shape check before lookup, a conditional delete consumes the token in the transaction.
  The sender hook (`PasswordResetSender`) and `mailingResetSender()` (`mailing/reset-mail.ts`) render copy from the
  module dictionaries and place the link in code.
- `server/roles.ts`: `isDeclaredRole`, `grantRole`; roles are rows of `auth.user_roles` (`ROLE_NAME_PATTERN`).
- `server/rate-limits.ts`: `BUCKETS` plus `assertAuthBuckets`, which requires optional buckets only when their feature
  is on (reset, OpenID Connect). A new `invitation` bucket follows the same rule.
- `next/current-user.ts`: `requireRole` (pages, not found for others) and `authorizeRole` (actions).
- `next/pages.tsx`: `RegisterPage` shows the closed page while the switch is on; the reset page shows the pattern for
  a token page (`same-origin` referrer meta, a neutral invalid page, the token in a hidden input).
- `feature-switches` `SwitchesPage`: the admin page pattern (`requireRole`, `Card`, a client panel with
  `useActionState`).
- `server/oidc/allowlist.ts` + `accounts.ts`: a provider links an existing account with the same verified email only
  when the email passes the allowlist (or `openSignUp`).
- Tests run on PGlite (`tests/support.ts`), which supports `SELECT ... FOR UPDATE`.
- No audit module exists in the repository; modules log with the `@softure-ai/auth:` prefix.

## Findings

- Reusing the register route (`/register?invitation=<token>`) needs no new mount for acceptance.
- A row lock on the invitation (select for update) before inserting the user keeps "exactly once" without a rollback
  trick: a failed insert returns before anything is written.
- OpenID Connect: an accepted invitation creates a password account; a provider then links it only through its own
  allowlist. Point 4 of the issue allows documenting how the two combine, which keeps the allowlist the single source
  of truth for provider sign-in.
