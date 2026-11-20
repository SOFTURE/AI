# Plan review

- Checked: the session/identity order in `completeOidcSignIn` (identity stamped in `resolveOidcAccount`, then
  `createSession`), so "the session follows the stamp within 60 s" identifies the sign-in's own session.
- Checked: FIRE-style full dictionaries typed as `PrivacyMessages` would break on new required keys; the keys are
  optional with an English fallback, like auth's `oidc` keys.
- No open findings.
