---
change_id: auth-oidc-display-name-802
---

# Research

## R1: where an `AuthUser` is built

`AuthUser` (`src/contract.ts`) is `{ id, email, createdAt }`. It is built from `auth.users` in: `server/sessions.ts`
(`findSessionUser`), `server/password-reset.ts` (`USER_COLUMNS`, `findPasswordResetUser`), `server/login.ts` (full row),
`server/register.ts` (returning row), `server/oidc/accounts.ts` (three selects and one returning), and
`testing/account.ts` (`createTestAccount`). Every reader of the current user (`getCurrentUser`, `requireUser`,
`requireRole`) goes through `findSessionUser`. Each site lists the three columns by hand.

## R2: the ID token claims

`server/oidc/id-token.ts` parses claims with zod (`claimsSchema`) and returns `IdentityClaims` (`subject`, `email`,
`isEmailVerified`, `hostedDomain`); `flow.ts` passes `{ subject, email }` to `resolveOidcAccount`. `name` and
`given_name` are dropped by the schema. OpenID Connect Core §5.4: `name` and `given_name` come with the `profile`
scope; the flow always requests only `openid email` (`REQUIRED_SCOPES`, `flow.ts`) plus `provider.scopes`, so with the
default configuration Google sends no name.

## R3: storage and privacy

`auth.users` (migration 0001) has no name column. `server/privacy.ts` exports `account: { id, email, createdAt,
passwordChangedAt }` and deletes the `users` row last. Migrations are numbered SQL files in `migrations/`; `schema.ts`
mirrors them for drizzle.

## R4: apps that build `AuthUser`

`modules/analytics/tests/next.test.ts` builds `{ id, email, createdAt }` as an `AuthUser`. An adopting app's tests may
do the same, so a required field would break them on a minor bump.

## R5: the fake provider

`testing/oidc-provider.ts`: `FakeOidcUser { subject, email, emailVerified?, hostedDomain? }`; `buildClaims` sets the
claims; `FakeSignInOptions.claims` overrides any claim.
