---
change_id: auth-github-sign-in-840
verdict: approved
---

# Plan review

- Coverage: every bullet of the issue maps to a step: same start (P1.3), endpoints and the 200-with-error answer
  (P1.2), the account read and email rule (P1.2), allowlist/identities/linking/onRegistered through the shared
  `resolveOidcAccount` (P1.3), the fake (P1.4).
- Compatibility: entries without `type` parse as before (default `"oidc"`); the parsed output gains `type`, which the
  module test's expectation must take. `OidcProvider` becomes a union: code that reads `provider.issuer` must narrow;
  inside the package only discovery and the ID token step do. Accepted for a patch: no adopting app reads it.
- Security: PKCE and state as for OpenID Connect; redirects are never followed (core), so the bearer token and secret
  never reach another host; the token is not stored; only verified emails count.
- Opt-in: no new table, bucket, route or copy. Approved.
