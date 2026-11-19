# Plan: auth-oidc-link-unverified

## Approach

Inside the existing transaction of `resolveOidcAccount`: before the identity insert, note whether the found account
(not a created one) has no identity yet; after the insert and the race check, revoke its access.

## Phases

### Phase 1: revoke on link (TDD)

- Test first: the existing "keeps its password" tests become "ends its password, sessions and reset link"
  (OIDC and GitHub); a new test proves an account a provider already verified keeps its session when a second
  provider links it.
- `hasNoIdentity` and `revokeUnverifiedAccess` helpers in `accounts.ts`.
- README Accounts paragraph, CHANGELOG 0.2.19.
- Done when: `npx vitest run modules/auth` passes, `tsc -p modules/auth` and ESLint on the changed files are clean.

## Progress

- [x] Phase 1: revoke on link

Evidence: `npx vitest run modules/auth` 38 files, 515 tests green; `npx tsc -p modules/auth --noEmit` clean; ESLint
clean on the changed files. Without the fix the replaced tests fail (`loginUser` succeeds with the old password).
