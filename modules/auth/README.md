# @softure-ai/auth

**Status:** wave 1 · **reference module for the standard** · depends on: core, db, ui, security · optional: mailing

Registration (with required consent), login, logout, password change (invalidates other sessions),
**password reset with an emailed token**, DB sessions (32-byte token, only its sha256 stored, 30-day TTL,
`httpOnly`/`lax`/`secure` cookie), `getCurrentUser` / `requireUser` / **`requireRole`**, a route guard for `proxy.ts`.
Passwords: `scrypt` from `node:crypto` (64-byte key, 16-byte salt, `timingSafeEqual`, a dummy verification
for unknown emails).

**Tables:** `auth.users`, `auth.sessions`, `auth.password_resets`*, `auth.user_roles`*

**Configuration:** routes, password policy, cookie name, session TTL, `requireConsent`, rate-limit buckets,
hooks `onRegistered(user, ctx)` (e.g. to record the acquisition channel), `onDeleted`.
**Switches:** `auth.registration_closed`.

**Source in FIRE_TRACKER:** `src/lib/{password,session,temporary-password}.ts`, `src/db/sessions.ts`,
`src/app/actions/{do-auth,auth,auth-contract,do-change-password}.ts`, `src/app/{login,register,nie-pamietam-hasla}/`,
`src/app/(app)/haslo/`, `src/components/auth-page.tsx`, `src/proxy.ts` (the auth part), `scripts/haslo*`.
Tests: `do-auth.test.ts` (829 LOC), `password`, `session`, `sessions`, `proxy`; e2e: `auth-boundary`, `konto-haslo`, `login-pending`.

**Improvements over the source:** password reset by email (today a manual admin step), roles and an admin
role (not present today), consent recorded through `privacy` (today only checked), `users` without billing and
analytics columns.

\* new
