# Plan: auth-password-reset

Input: change.md, research.md. Complexity: medium (2 phases).

## Goal

`@softure-ai/auth` gains password reset:

- option `passwordReset: { send?, ttlMinutes = 60 }`; `consolePasswordResetSender` (dev only);
- table `auth.password_resets` (migration `0003_create_password_resets.sql`), Drizzle
  `passwordResets`, manifest `tables`, `module.json`, health check;
- buckets `password-reset`, `password-reset-account`, `password-reset-confirm` in
  `AUTH_RATE_LIMIT_BUCKETS`;
- `@softure-ai/auth/server`: `requestPasswordReset`, `issuePasswordReset`, `findPasswordResetUser`,
  `resetPassword`, `prunePasswordResets`, `isPasswordResetEnabled`; `changePassword` also deletes
  a pending reset;
- routes `forgotPassword` (`/forgot-password`) and `resetPassword` (`/reset-password`); pages
  `ForgotPasswordPage`, `ResetPasswordPage`; actions `forgotPasswordAction`, `resetPasswordAction`;
  forms `ForgotPasswordForm`, `ResetPasswordForm`; a "forgot password" link on the login form;
- error code `auth.reset_token_invalid`, `auth.password_reset_unavailable`; copy in en and pl;
- README sections.

The example app configures a sender (outbox file for e2e, console otherwise), mounts both pages,
and `e2e/auth-reset.spec.ts` covers request → link → new password, the identical answer for an
unknown email, single use, ended sessions, and the request rate limit.

**Out of scope:** mail templates and the mailing adapter (EN-4), email verification, reset by an
admin.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Token | 32 random bytes, sha256 stored | same as sessions | research |
| Pending | one row per user (PK `user_id`), new request replaces | invariant as a constraint | research 2 |
| TTL | 60 min default | OWASP, mail delays | research 1 |
| Link origin | `appOrigin` + route, never Host | reset poisoning | research 3 |
| Enumeration | same answer, issuing and sending in `after()` | timing and failures | research |
| Consume | conditional delete in the reset transaction | single use under races | research |
| No sender | feature off (not found) | no secrets in logs | research |

## Phase 1: Table, options and server functions

**Discipline:** TDD (security rules).

- `migrations/0003_create_password_resets.sql`, `src/schema.ts`, health, manifest, `module.json`.
- `src/options.ts`: `passwordReset`; `src/password-reset-sender.ts`: types and console sender.
- `src/server/password-reset.ts`, buckets in `rate-limits.ts` and `AUTH_RATE_LIMIT_BUCKETS`,
  routes in `options.ts`, `changePassword` deletes the pending reset.
- `contract.ts` codes; messages en + pl.
- Tests: `tests/password-reset.test.ts`, module defaults, health, constraints, messages.

## Phase 2: Next adapter, example app and e2e

**Discipline:** test-after (wiring).

- `src/next/actions.ts` (two actions, `after()`; a successful reset redirects to the login page
  with `?reset=1`, which shows the confirmation: without JavaScript the reset page would render
  again with a used token), `src/next/pages.tsx` (two pages, login link and notice),
  `src/ui/auth-forms.tsx` (two forms), `next-modules.d.ts` (`next/server`), exports.
- Example: `softure.config.ts` (auth entry only), `lib/password-reset-sender.ts`,
  `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, Playwright env, `.gitignore`.
- `e2e/auth-reset.spec.ts`; `e2e/migrations.spec.ts` lists `auth 3 create_password_resets`.
- README: reset section, options, buckets, mounting, tables, limitations.

## Risks and rollback

- Migration rollback: `DROP TABLE auth.password_resets;` and the ledger row (in the SQL header).
- If `after()` in a packaged server action misbehaves, the e2e (which waits for the outbox line)
  catches it before merge.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Table, options and server functions

#### Automated
- [x] 1.1 Reset tests (issue, request, reset, races, expiry, constraints, health, options) pass on PGlite — 1dd1834
- [x] 1.2 `module.json` equals `toModuleJson(auth)` and the package passes `tests/repo/packages.test.ts` — 1dd1834
- [x] 1.3 Gates green (typecheck, lint, test) — 1dd1834

### Phase 2: Next adapter, example app and e2e

#### Automated
- [x] 2.1 `npm run e2e` passes against a local PostgreSQL 16, including `auth-reset.spec.ts`
- [x] 2.2 Gates green (typecheck, lint, test, build)
