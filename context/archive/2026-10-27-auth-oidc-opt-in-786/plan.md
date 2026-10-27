---
change_id: auth-oidc-opt-in-786
status: archived
---

# Plan: OpenID Connect strictly opt-in (issue #786, follow-up)

Input: change.md, research.md. Complexity: small (one test, docs).

## Phase 1: pin the opt-in behaviour and document it

Files: `modules/auth/tests/login.test.ts`, `modules/auth/tests/support.ts`, `modules/auth/src/index.ts` (doc comment),
`modules/auth/README.md`, `modules/auth/CHANGELOG.md`.

1. Test: an app without a provider, with only the 0.2.5 buckets (no `oidc-*`), registers and logs in; afterwards
   `auth.identities` and `auth.oidc_states` are empty and no `oidc-*` rate limit row exists.
2. `AUTH_RATE_LIMIT_BUCKETS` doc comment: the `oidc-*` entries are inert without a provider and may be left out.
3. README, OpenID Connect section: a "Without a provider" paragraph listing what an app without OpenID Connect gets
   (two empty tables, two optional bucket defaults, optional copy, no route to mount) and the one step it takes on
   the bump (`softure migrate`).
4. CHANGELOG `Unreleased`: the upgrade steps for an app without a provider, explicitly; correct the 0.2.6 "Additive"
   sentence so it names the migration and the copy keys.

## Decisions (auto)

- Keep the tables for every app and document them as inert, the issue's accepted fallback. Conditional migrations
  would need a core/db feature, a gap in auth's migration sequence, and a destructive step for apps already on 0.2.6+
  (R1).
- Keep the two bucket defaults in `AUTH_RATE_LIMIT_BUCKETS`: removing them breaks apps with a provider in a patch
  (R2). They are already optional in the check.
- Correct the published 0.2.6 note in place: the changelog is read by automated bumps, so a wrong claim is a bug.

## Progress

- [x] Phase 1: pin the opt-in behaviour and document it (bef85a3, auth and repo tests green)
