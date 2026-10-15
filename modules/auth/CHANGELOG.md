# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/auth`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`auth@x.y.z`).

## 0.2.3

- `createCreateAccountScript(config, { maxAccounts?, alphabet?, clock? })` in `@softure-ai/auth/scripts` (#521): the
  `create-account` ops script creates an account while registration is closed, with a drawn temporary password or a
  given `--password-hash`, dry run by default. It refuses an existing or invalid email and, with `maxAccounts`, a
  table that already holds that many accounts (the table is locked for the run). Migrate (optional): an app that
  inserted its first account into `auth.users` itself, or added its own index to hold one account, uses the script
  with `maxAccounts: 1` instead.

## 0.2.2

- Password reset mails can leave from a background job with retry (#494): `auth({ passwordReset: { send, enqueue:
  enqueuePasswordReset } })` from the new entry `@softure-ai/auth/jobs`, with `@softure-ai/jobs` as an optional peer
  dependency (`^0.1.1`). The request then only enqueues `{ userId }` on the `auth.password-reset` queue; the handler
  issues the link when it runs (valid for `ttlMinutes` from the send) and calls the sender, retrying a failure with the
  queue's backoff. `deliverPasswordReset` returns `"queued"` in that mode; `sendPasswordReset(ctx, userId)` is the
  handler's work for an app's own worker. Without `enqueue` nothing changes. Migrate (optional): install
  `@softure-ai/jobs`, add `jobs({ queues: { "auth.password-reset": {} } })` to `softure.config.ts`, pass
  `enqueue: enqueuePasswordReset`, and spread `passwordResetJobHandlers` into the worker's `handlers`.

## 0.2.1

- `@softure-ai/auth/jobs` (#491): `authJobHandlers` and `authJobSchedules` run `pruneSessions` (hourly) and
  `prunePasswordResets` (daily) as `@softure-ai/jobs` schedules; `@softure-ai/jobs` (^0.1.1) is a new optional peer. Migrate
  (optional): an app with `@softure-ai/jobs` adds `...authJobSchedules` to `jobs({ schedules })` and
  `...authJobHandlers` to its worker's handlers, then removes the cron or script that called the two prunes. Without
  jobs nothing changes.

## 0.2.0

- **Breaking (#446):** the built-in `pl` dictionary is gone; English is the only built-in copy and the fallback for
  every other locale, which is now any BCP 47 tag. Migrate: an app that shows Polish keeps its own translation and
  passes it as the overrides for its locale, `auth({ messages: { pl: myTranslation } })`; a key it leaves out reads
  English.
- `createAuthGuard` with `redirect: "relative"` answers 307 inside Next's proxy instead of 500 (`Invalid URL`): the
  login URL is built on the request URL's own origin, which Next sends to the browser path-only, as before (#452). An
  app that went back to the absolute redirect with its stack's origin in `origins.trustedOrigins` can switch back.
- `createAuthGuard` drops Next's `_rsc` cache key from `next=` and keeps every other query parameter as the request
  spelled it, so a signed-out client navigation no longer lands on `/page?_rsc=…` after sign-in (#424). An app that
  strips `_rsc` before calling the guard can drop that.

## 0.1.13

- `resolveOnlyAccount({ db, envName, env? })` in `@softure-ai/auth/server`: the account a local tool acts for, named by
  an environment variable or the only one in the database; refuses `auth.account_unknown`, `auth.no_account` and
  `auth.account_ambiguous` with a readable `message` (#411). An app drops its own copy of this lookup.
- `runSeedAccount({ config, env? })` in `@softure-ai/auth/scripts`: a development account from `SEED_EMAIL` /
  `SEED_PASSWORD` through registration (the `onRegistered` hook runs), idempotent, refused under
  `NODE_ENV=production`; returns the exit code (#411).
- The `@softure-ai/ui` peer range also accepts 0.2.0.

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
