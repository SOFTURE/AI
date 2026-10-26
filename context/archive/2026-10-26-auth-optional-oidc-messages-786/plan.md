---
change_id: auth-optional-oidc-messages-786
status: archived
---

# Plan: optional OpenID Connect message keys (issue #786)

Input: change.md, research.md. Complexity: small (one type, two readers, tests, docs).

## Phase 1: optional keys with English fallback

Files: `modules/auth/src/messages/index.ts`, `src/ui/oidc-sign-in.tsx`, `tests/messages.test.ts`,
`tests/oidc-ui` or the existing OidcSignIn test, `CHANGELOG.md`, `README.md` when it documents `AuthMessages`.

1. `AuthMessages`: `typeof en` with `oidc` and the four `errors.auth.oidc_*` keys optional. `en` still satisfies it.
2. `getAuthErrorMessage`: a known code missing from the app's dictionary gets the English copy; an unknown code still
   gets the dictionary's `core.unexpected`.
3. `OidcSignIn`: `messages.oidc ?? en.oidc`.
4. Tests: a dictionary typed `AuthMessages` without the oidc keys compiles (typecheck runs over tests); its oidc error
   codes read the English copy; `OidcSignIn` renders the English button and divider from it.
5. CHANGELOG `Unreleased`: the fix, and that 0.2.6 required the keys despite "additive".

## Decisions (auto)

- Optional keys (the issue's preferred option) over a documented migration step: the bump stays additive.
- The fallback covers only the oidc keys in the type; the lookup fallback to `en` is general (any known code), since
  it is cheaper than a special case and never worse than the generic failure.

## Progress

- [x] Phase 1: optional keys with English fallback (a5dc750, auth tests 464/464)
