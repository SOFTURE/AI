---
change_id: auth-create-account-script-521
---

# Research: create-account script (issue #521)

- `modules/auth/src/scripts/temporary-password.ts`: the model to follow. `defineOpsScript` with a zod strict args
  object, `secrets: ["password-hash"]`, `refuseOpsScript(reason)` for refusals, `ok({ before, after })` report;
  `choosePassword` draws `max(password.minLength, 20)` characters or takes a hash checked by `isPasswordHash`.
- `registerUser` (`src/server/register.ts`) refuses with registration closed and needs consent, a rate limit key and
  opens a session; not usable. `runSeedAccount` refuses under `NODE_ENV=production`. `createTestAccount` is test-only.
- `auth.users` (`src/schema.ts`): `email` unique (`users_email_key`), `created_at` and `password_changed_at` not null.
  `parseEmail` (`src/server/validation.ts`) normalizes and validates; insert with `onConflictDoNothing` on email makes
  an existing account a refusal without a failed statement.
- `executeOpsScript` runs `run` in one transaction and rolls it back on a dry run, so `LOCK TABLE auth.users IN SHARE
  ROW EXCLUSIVE MODE` (conflicts with itself and with inserts) serializes the count check with any other writer for
  the transaction only. Tests run on PGlite, which is Postgres and accepts the lock.
