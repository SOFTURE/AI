---
change_id: auth-oidc-display-name-802
status: archived
---

# Plan: display name from OpenID Connect (issue #802)

Input: change.md, research.md. Complexity: small to medium (one column, one claim, one shared selection, tests, docs).

## Phase 1: store and expose the display name

Files: `migrations/0006_add_users_display_name.sql`, `src/schema.ts`, `src/contract.ts`, a shared column selection
(`src/server/user-columns.ts`), `server/sessions.ts`, `server/password-reset.ts`, `server/login.ts`,
`server/register.ts`, `server/oidc/{id-token,flow,accounts}.ts`, `server/privacy.ts`, `testing/{account,oidc-provider}.ts`,
tests, `README.md`, `CHANGELOG.md`, `module.json` (no table change).

1. Migration 0006: `ALTER TABLE users ADD COLUMN display_name text` with a CHECK (null, or 1 to 200 characters,
   trimmed); rollback in the header.
2. `AuthUser.displayName?: string | null`; every select of an `AuthUser` uses one `AUTH_USER_COLUMNS` selection, so
   the package always fills it (null for a password account).
3. ID token: `name` and `given_name` parsed leniently (a bad or long value never refuses the sign-in), normalized
   (NFC, whitespace collapsed, control characters removed, trimmed, at most 200 characters); `name` first, else
   `given_name`, else null. `IdentityClaims.displayName`, `OidcIdentity.displayName`.
4. `resolveOidcAccount`: on every sign-in (linked, linked now, created) a sent name is written to `users.display_name`
   and returned; no name keeps the stored one.
5. Request the `profile` scope with `openid email`.
6. Privacy: `account.displayName` in the export; the deletion already removes the row.
7. Fake provider: `FakeOidcUser.name?`, `givenName?`.
8. Tests: first sign-in stores the name; a later sign-in refreshes it; no name keeps it; `given_name` fallback; a
   blank or overlong name; `findSessionUser` returns it; a password account has null; privacy export lists it;
   the authorize URL carries `profile`. Existing exact `AuthUser` assertions gain `displayName: null`.
9. README (OpenID Connect section, tables section, `AuthUser`), CHANGELOG `Unreleased`.

## Decisions (auto)

- Column on `auth.users`, not on `auth.identities`: the issue asks for it "on the account", and an account has one name
  whatever the provider; the latest sign-in wins.
- `displayName` is optional in the type (`displayName?: string | null`) but always set by the package: an app's own
  `AuthUser` literal keeps compiling (R4); readers treat `undefined` like null.
- A token without a name keeps the stored name instead of clearing it: a provider configured without `profile`
  should not erase what an earlier sign-in stored.
- `profile` joins the always-requested scopes: it is a standard scope, Google shows it as part of basic sign-in, and
  without it the default configuration gets no name (R2).
- Only `name`, with `given_name` as a fallback; no separate given name field (the issue's "optionally").
- A bad name claim is ignored, never a reason to refuse the sign-in.

## Progress

- [x] Phase 1: store and expose the display name (8ab2891, auth tests 467/467)
