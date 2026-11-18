# Plan: an account a provider created deletes itself by signing in again

## Approach

Re-authentication by a fresh provider sign-in, checked in auth (which owns sessions and identities) and used by
privacy's deletion, its form and its page.

## Phases

### Phase 1: auth

- `findRecentProviderSignIn`, `findLinkedProviders` in `src/server/reauthenticate.ts`; tests in
  `tests/reauthenticate.test.ts` through the fake provider's real flow (fresh, expired window, password session,
  another user's session, malformed token, password-only account).
- Done when: the tests pass; typecheck and lint clean.

### Phase 2: privacy

- `deleteOwnAccount` with `sessionToken`, `privacy.reauthentication_required`, `deletion.recentSignInMinutes`,
  `getDeletionReauthentication`; `/next` `getDeleteAccountReauthentication` and `readSessionToken`; the form's
  `reauthentication` prop; optional message keys with English fallback.
- Tests: server (fresh sign-in deletes without a password, window, option, password session refused, typed password
  still checked, form data), form (button posts `provider` and `next`, no password field without passwords or after a
  fresh sign-in, error placement, older dictionary), messages.
- Done when: the module's tests pass; typecheck and lint clean.

### Phase 3: docs, versions

- READMEs, CHANGELOGs; `npm run release:version -- auth patch`, `privacy patch`; privacy depends on auth `^0.2.18`.

## Progress

- [x] Phase 1: auth
- [x] Phase 2: privacy
- [x] Phase 3: docs, versions
