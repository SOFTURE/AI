# Plan: auth-invitations-fk-indexes

## Approach

Add migration 0008 with two plain indexes and a test that guards every auth foreign key, then document it.

## Decisions (auto)

- New migration 0008 instead of editing the released 0007 (migrations move forward only).
- Plain (not partial) indexes `invitations_invited_by_idx` and `invitations_accepted_user_id_idx`.
- The guard test covers the whole `auth` schema, not only invitations, so a future table cannot repeat the gap.
- The CHANGELOG entry goes under `Unreleased`; the release is a separate version-bump pull request right after the
  merge (patch: six packages depend on `^0.2.x`).

## Phases

1. Test first (fails on master), then migration 0008, the schema comment, README section 5, the example app's
   migration list and CHANGELOG `Unreleased`.

## Acceptance

- `npx vitest run modules/auth/tests/module.test.ts` passes and the new test fails without 0008.
- `npm run typecheck`, `npm run lint` green; the e2e migration list matches.

## Progress

- [ ] Phase 1
