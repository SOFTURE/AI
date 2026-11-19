# Research: auth-oidc-link-unverified

- `registerUser` (`server/register.ts`) stores the email without any proof of ownership; there is no email
  verification in auth.
- `resolveOidcAccount` (`server/oidc/accounts.ts`) finds by subject, else by the verified email, inserts the
  identity and returns the user. Password, sessions (`auth.sessions`) and resets (`auth.password_resets`) are untouched.
- `completeOidcSignIn` then opens a new session; older sessions stay valid until they expire.
- The GitHub flow uses the same `resolveOidcAccount`, so one fix covers both.
- `passwordChangedAt` is what `revokeUserSessions`-style checks and the reset flow already use; setting it is safe.
