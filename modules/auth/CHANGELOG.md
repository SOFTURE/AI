# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/auth`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`auth@x.y.z`).

## 0.1.12

- `createAuthGuard({ redirect: "relative" })` answers with a path-only `Location` (`/login?next=…`), so a stack on a
  port or host the config cannot list keeps the browser where it is; `createAuthGuard({ excludeExact })` lets exact
  paths through (`/pricing` and `/pricing/`, not `/pricing/plans`) for an app with an exact public allowlist (#314).
- `createTestAccount` builds fixture accounts (#314): `id`, `createdAt` and a ready `passwordHash` (stored as is, never
  hashed); a module context (`{ db, clock, config }`) as the first argument hashes with the app's parameters and, with
  `runHooks: true`, runs the app's `onRegistered` in the account's transaction (`fields` for `event.fields`). One
  password with one set of parameters is hashed once per test run.
- `adminEmails` also takes the raw environment string (#314): entries split on commas and whitespace, trimmed and
  lowercased; an entry that is not an email is dropped with one log line naming its position and grants nothing. A
  list still refuses a bad entry at config load.

## 0.1.11

- The guard's login redirect uses core's `resolveAppOrigin` (#311): an origin listed in the config's
  `origins.trustedOrigins` is trusted like one in the guard's `trustedOrigins` option, and `origins.trustRequestHost`
  is honoured. A non-http(s) `X-Forwarded-Proto` value now falls back to the URL's scheme instead of making the
  origin unreadable. Needs `@softure-ai/core` 0.1.8.
- `AUTH_RATE_LIMIT_BUCKETS` declares what each bucket counts by: `register`, `login`, `password-reset` and
  `password-reset-confirm` `key: "ip"`; `login-account`, `change-password` and `password-reset-account`
  `key: "account"`. Change one threshold with `overrideBuckets` from `@softure-ai/security` 0.1.8.
- Requires `@softure-ai/security` `^0.1.8`: earlier versions refuse the `key` field.

## 0.1.10

- `isPasswordHash(value)` is exact: the salt and key must be unpadded base64url of exactly 16 and 64 bytes (22 and 86
  characters) and the cost a power of two above 1. A hash cut by a character or carrying a stray one no longer
  passes, so `set-temporary-password --password-hash` refuses it as a usage error instead of storing a hash that
  locks the account. Reading stored hashes at login is unchanged.

## 0.1.9

- `set-temporary-password` takes `--password-hash=<hash>` (or `--password-hash-file=-` from stdin): the script stores a
  hash computed elsewhere instead of drawing a password, so the plain password never reaches the server. The report
  then says `passwordFrom: "hash"`; a value that is not a module hash is a usage error and is never printed.
- `createSetTemporaryPasswordScript(config, { alphabet })` chooses the characters of a drawn password.
- `createTemporaryPassword({ alphabet, length })`, `READABLE_PASSWORD_ALPHABET` (no `0/O`, `1/l/I`, `-`, `_`) and
  `isPasswordHash(value)` are exported from `@softure-ai/auth/server` for the operator's local half.

## 0.1.8

- `logoutAction({ next })`, a `next` form field and `<LogoutButton next>` choose where logout goes; the path is
  checked like login's `next` and falls back to `routes.afterLogout`.
- `createAuthGuard({ trustedOrigins })` keeps the login redirect on the request's public origin when it is listed;
  without the option the redirect stays on `appOrigin`.
- README: when to set `cookie.secure` explicitly, and the Vitest `server.deps.inline` setting the `/next` entry needs.

## 0.1.7

- `module.json` names `mailing` and `ops` as optional dependencies.
- Adapters and commands use the configured database handle; `@softure-ai/ui` is a peer dependency.
- Deny-by-default route guard and the legacy session cookie name.
- Registration fields, a register page factory, a submit variant and longer `next` paths.
- Legacy password hashes normalised to NFC, an unchanged new password refused, conditional reset buckets, session revocation.
- `set-temporary-password` ops script; `@softure-ai/ops` is an optional peer.
- `createTestAccount` in `@softure-ai/auth/testing`.
