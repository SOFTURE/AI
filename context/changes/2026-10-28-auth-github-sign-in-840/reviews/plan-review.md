---
change_id: auth-github-sign-in-840
verdict: approved
---

# Plan review

- Coverage: every bullet of #840 maps to a step (start reuse: 3; endpoints and the 200 error: 2; account and verified
  emails: 2; allowlist and identities: 1, 3; fake: 4).
- Compatibility: the discriminator defaults to `oidc`, so existing entries parse unchanged; step 5 pins that.
- Security: the access token stays in memory for two GET calls; no redirect is followed (`requestJson`), endpoints
  are constants, unverified emails never count, the subject is GitHub's numeric id (a renamed login keeps the
  account). Accepted.
- Scope: no migration, no version bump. Approved.
