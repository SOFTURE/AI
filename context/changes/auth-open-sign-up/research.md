# Research: auth-open-sign-up

- `options.ts`: `allowlistShape` (allowedDomains, allowedEmails, createAccounts) is spread into both provider schemas;
  the union's `.refine` requires one non-empty list.
- `server/oidc/allowlist.ts`: `isAllowedEmail` decides for both protocols (`getAllowedEmail` for OpenID Connect,
  `pickGithubEmail` in `github.ts` walks the verified emails, primary first).
- `server/oidc/accounts.ts`: `resolveOidcAccount` creates the account inside one transaction and ignores
  `registrationClosed` on purpose ("the allowlist is the gate"). With no allowlist the switch must be the gate.
- `server/switches.ts`: `isRegistrationClosed` returns true whenever `password.enabled` is false, so it cannot be reused
  as is for an open provider of a passwordless app; the switch reading below it can.
- PGlite in the tests has one connection: a switch read inside the transaction would wait on it, so the switch is read
  before the transaction.
- Error codes: `OidcSignInErrorCode` is every `auth.oidc_*` code, the login page shows any code of the right shape, and
  `AuthMessages` keeps the `oidc_*` keys optional (`messages/index.ts`), so a new code needs its name added there.
- Consent: an account created through a provider runs `onRegistered` with `consent: null`; an app shows its terms next
  to the button. Recording a consent from the button would need state in `auth.oidc_states` (a migration); out of scope.
