# Research: auth-testing-account-factory

Date: 2026-10-06

## What registration writes (`modules/auth/src/server/register.ts`)

One transaction: an `auth.users` row (`email` normalized by `parseEmail`: trimmed and lowercased;
`password_hash` from `hashPassword(password, options.password.scrypt)`; `created_at` and
`password_changed_at` both "now"), then the app's `onRegistered` hook, then a session row. Roles live in
`auth.user_roles` (`user_id`, `role`, `granted_at`; the migration's CHECK enforces the role name shape).
The hash describes its own parameters (`scrypt$N$r$p$salt$key`); a login with other parameters than the
configured ones succeeds and then rehashes (`needsRehash`), which is a write the test did not ask for.

## The roadmap's unknown: a `@softure-ai/db` handle or a drizzle instance

A drizzle instance, typed `Queryable` from `@softure-ai/db` (a database or a transaction), as every
function in `@softure-ai/auth/server` takes it. An e2e passes `handle.db` of `createDatabase`; a Vitest
suite passes PGlite's `database.db` (`@softure-ai/db/testing`); a caller can pass its own transaction.
A handle would tie the factory to the pool's lifecycle, which the caller owns (`withDatabase`).

## Design details

- **Hash parameters.** `scrypt` is an option; the default is auth's own default (`DEFAULT_SCRYPT_COST`,
  r 8, p 1), which is what an app without `password.scrypt` runs. An app with its own cost passes
  `getAuthOptions(config).password.scrypt`, so its first login does not rehash. The example passes its
  config's value, so the spec and the app cannot drift.
- **Email.** Normalized exactly as registration does (`parseEmail`). An invalid or taken email throws:
  in test setup it is a bug, not an expected outcome, so it is not a result type. The message names the
  email (test data, not a secret).
- **Password.** Not checked against the length policy: a factory may need an account the form would
  refuse (for example after the app raised `minLength`). The hash input is the same as registration's.
- **Roles.** Inserted as given. Without the app's config the factory cannot know the declared roles;
  the database CHECK guards the shape, and `findUserRoles` reads whatever is stored.
- **No hook, no session.** The factory creates an account, not a registration: `onRegistered` does not
  run (no consent row, no sign-up attribution, no funnel count). Tests sign in through the login form
  (`logIn` of `@softure-ai/testing/playwright`), the black-box path; minting a session token would
  bypass the cookie options the app configured.
- **Returns** the `AuthUser` (`id`, `email`, `createdAt`), so specs no longer select the id back.

## The example app's e2e (`examples/next-app/e2e/`)

Tests that fill the registration form, and why:

| Spec | Today | After |
| --- | --- | --- |
| `auth.spec.ts` | 9 tests register | form stays in the 2 tests about registration (new user signed in with the cookie; no-JavaScript register, logout, login); the taken-email test creates its existing account with the factory and submits the form once; the guard, logout, wrong password, `next`, login-account limit and password change tests use the factory and log in |
| `auth-reset.spec.ts`, `auth-reset-mail.spec.ts` | register, then reset | factory; the reset needs an account, not a session, so most tests no longer sign in at all |
| `auth-roles.spec.ts` | registers the `adminEmails` admin and plain users | factory (admin from `adminEmails` with no role row); the `grant-role` script test keeps the script |
| `billing-*.spec.ts`, `feature-switches.spec.ts`, `mailing-*.spec.ts`, `mcp-access.spec.ts`, `privacy-export-delete.spec.ts` | register (and grant admin in SQL or with the script) to get a signed-in account | factory (`roles: ["admin"]` for admins) and log in |
| `registration-switch.serial.spec.ts` | registers an admin with the script, then tries the form | the admin comes from the factory; the registration attempts stay on the form |
| `privacy-consents.spec.ts` | registers | form stays: it checks the consent registration records |
| `analytics-channel.spec.ts`, `analytics-funnel.spec.ts` | register through their own steps | form stays: they check what a sign-up records |

Dependencies checked: no converted spec reads a consent row or the sign-up channel. `privacy-export-delete`
reads the export's module keys (present for any account) and deletes with the password (the factory's
password works). Billing's trial is computed from the account and entitlement rows the specs write
themselves. The login buckets (`login` 50 per client, `login-account` 10 per account) are not reached:
each test has its own client address and account.

## Version

The next patch. Dependents (`billing`, `feature-switches`, `mcp-access`, `privacy`, `waitlist`)
require `^0.1.0`; a `0.2.0` would fall outside their ranges (`release-rules` refuses it). The change is an
additive, test-only entry.

Planned as `0.1.4` → `0.1.5`; while this change ran, `release-0-1-5` moved every package to 0.1.5 on `master`
and `auth@0.1.5` was tagged without this entry, so auth goes to `0.1.6`.
