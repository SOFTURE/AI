---
change_id: auth-oidc-opt-in-786
---

# Research

## R1: the tables

- `migrations/0005_create_identities_and_oidc_states.sql` (shipped in 0.2.6) creates both tables; `0006` (0.2.7) adds
  `users.display_name` after it.
- `@softure-ai/db` requires a module's migrations to run `1..n` without gaps (`foundation/db/src/migrations/files.ts`,
  "breaks the sequence") and records each in `softure.migrations` with a checksum. There is no notion of a migration
  that depends on module options: `softure migrate` reads the files, not the app's `auth({ ... })`.
- So skipping `0005` for an app without a provider would need a new conditional-migration feature in core and db, and a
  gap in auth's sequence before `0006`. Apps that already ran 0.2.6 or 0.2.7 have the tables; removing them would be a
  destructive migration. Not proportional to the gain: two empty tables.
- Readers of the tables: the OpenID Connect flow (only with a provider), the privacy export and deletion (read/delete
  by user, empty without a provider), the health probe (`select 1 ... limit 0`). Without a provider nothing writes a
  row: the tables stay empty and cost nothing.

## R2: the buckets

- `assertAuthBuckets` (`src/server/rate-limits.ts`) requires `oidc-start` and `oidc-callback` only when
  `oidc.providers` is not empty. An app that configures its buckets by hand with the 0.2.5 set keeps working.
- `AUTH_RATE_LIMIT_BUCKETS` carries the two OpenID Connect defaults, so an app that spreads it gets two bucket
  definitions. A bucket definition is configuration only: `security.rate_limits` rows appear only when an attempt is
  counted, which only the OpenID Connect flow does.
- Dropping them from `AUTH_RATE_LIMIT_BUCKETS` would break an app that enabled a provider and relies on the spread
  (a startup error on its first sign-in) in a patch release. Not acceptable.

## R3: the docs today

- CHANGELOG 0.2.6 says "Additive: an app without `oidc` sees no change except two new bucket defaults". It omits the
  migration and, until 0.2.7, the message keys.
- README "OpenID Connect sign-in" says "Off without providers" but not what an app without a provider still gets.
- No test pins "no provider: no OpenID Connect bucket needed, no OpenID Connect row written".
