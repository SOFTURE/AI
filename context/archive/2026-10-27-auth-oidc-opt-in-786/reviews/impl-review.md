---
change_id: auth-oidc-opt-in-786
verdict: approved
---

# Implementation review

- Plan conformance: steps 1 to 4 done in bef85a3.
- Proof: `tests/login.test.ts` "needs no OpenID Connect bucket and writes no OpenID Connect row without a provider"
  configures every bucket except `oidc-*`, registers and logs in, then finds `auth.identities` and `auth.oidc_states`
  empty and no `oidc-*` rate limit row. The claim "inert without a provider" in README and CHANGELOG is now tested.
- Docs: README section 3 "Without a provider" (tables, buckets, copy, routes, the one step); CHANGELOG `Unreleased`
  with the explicit steps for an app without a provider; the 0.2.6 entry corrected (no longer "additive" without
  naming migration `0005` and the then-required copy keys).
- No behaviour change, no new export. The `AUTH_RATE_LIMIT_BUCKETS` doc comment says the `oidc-*` entries may be
  left out without a provider.
- Gates: typecheck, lint, language clean; auth and repository tests green (deploy-workflows needs `ssh-keygen`,
  installed in the container).
