---
change_id: auth-optional-oidc-messages-786
verdict: approved
---

# Plan review

- Coverage: the issue's preferred outcome (optional keys, English fallback, really additive) has steps 1 to 3;
  step 4 proves the compile and the runtime fallback, step 5 the changelog.
- Risk: making keys optional breaks a reader that assumed them. Only two readers exist (R2), both get a fallback;
  typecheck under `exactOptionalPropertyTypes`/strict flags any other. Accepted.
- Risk: `getAuthMessages` and mailing still return the merged full dictionary typed `AuthMessages`; they read no oidc
  key. Accepted.
