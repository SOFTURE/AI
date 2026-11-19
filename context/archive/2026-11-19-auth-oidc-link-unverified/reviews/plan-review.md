# Plan review: auth-oidc-link-unverified

- Checked: the revocation runs after the race check, so a refused link revokes nothing. OK.
- Checked: a created account (`isCreated`) is never revoked, so the new session is not deleted. OK.
- Checked: the new session is inserted by `completeOidcSignIn` after `resolveOidcAccount`, so deleting sessions in
  the transaction does not end it. OK.
- Verdict: approve.
