# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/auth`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`auth@x.y.z`).

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
