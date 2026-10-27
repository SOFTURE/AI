---
change_id: auth-oidc-display-name-802
verdict: approved
---

# Plan review

- Coverage: the issue's three asks (store and refresh, `displayName` on `AuthUser`, privacy export and deletion) map to
  steps 1 to 6; step 8 proves each, step 9 documents the migration for an app.
- Risk: a required field breaks app literals. Mitigated by the optional property (decision); the package itself always
  fills it, and one shared selection keeps the sites from drifting.
- Risk: the new `profile` scope changes the authorize URL; it is standard OIDC and Google already treats it as basic.
  The existing authorize URL test is updated, and the CHANGELOG names it.
- Risk: a hostile or broken provider sends a huge or control-laden name. The lenient parse, normalization, length cap
  and a database CHECK keep it bounded; React escapes it when shown.
- Risk: migration on a large `users` table. `ADD COLUMN` nullable without default is metadata-only in Postgres. Accepted.
