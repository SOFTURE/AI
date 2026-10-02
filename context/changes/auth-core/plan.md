# Plan: auth-core

Input: change.md, research.md. Complexity: high (3 phases).

## Goal

`@softure-ai/auth` (`modules/auth/`) is a workspace package that gives an app:

- `auth({ routes, password, session, cookie, requireConsent, registrationClosed, onRegistered })`,
  the module factory, with tables `auth.users` and `auth.sessions` and their migration;
- `@softure-ai/auth/server`: `registerUser`, `loginUser`, `logoutSession`, `findSessionUser`,
  `changePassword`, `pruneSessions`, `hashPassword`, `verifyPassword`, `isRegistrationClosed`;
- `@softure-ai/auth/next`: `loginAction`, `registerAction`, `changePasswordAction`, `logoutAction`,
  `getCurrentUser`, `requireUser`, `LoginPage`, `RegisterPage`, `ChangePasswordPage`, `LogoutButton`,
  `getSessionRoute`;
- `@softure-ai/auth/proxy`: `createAuthGuard(config, { protect })`;
- `@softure-ai/auth/ui`: `LoginForm`, `RegisterForm`, `ChangePasswordForm` with slots;
- pl + en messages, a README with the twelve sections, `AUTH_RATE_LIMIT_BUCKETS`.

`@softure-ai/db` gains `getSharedDatabase(url)`. The example app mounts auth, guards `/account`,
and `e2e/auth.spec.ts` drives it on `next start`; the next-actions spike is removed.

**Out of scope:** roles (ID-4), password reset (ID-5), the `feature-switches` lookup (ID-6), consent
storage (`privacy`, engagement roadmap), sliding session renewal.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Hash | scrypt N=2^17 r=8 p=1, 16-byte salt, 64-byte key, self-describing string, rehash on login | OWASP cost, FIRE key and salt sizes | research |
| Unknown email | dummy verification at the configured cost | no account enumeration through timing | roadmap |
| Session | 32-byte token, sha256 hex as PK, fixed TTL (30 days) | only hashes stored (NFR-5) | roadmap |
| Cookie | `__Host-` / `__Secure-` / bare by `secure` and `domain`; HttpOnly, Lax | unknown 2 | research |
| Guard | `(Request) => Response \| null`, cookie presence only, own entry point | unknown 1 | research |
| Switch | `isRegistrationClosed(config, env)`: env override over the declared default, fail closed | unknown 3 | research |
| Register | one transaction: user, hook, session | consent storage cannot be lost | research |
| Rate limits | `register`, `login`, `login-account`, `change-password`, before hashing | ID-2 contract | change.md |
| Results | `Result<T, AuthErrorCode \| security codes>`; DB errors propagate to the adapter, which returns `safeError` | AGENTS.md errors | AGENTS.md |
| Forms | `useActionState(serverAction)`; `redirect()` on success; works without JavaScript | ActionForm catches redirects | research |
| `next` param | same-origin path only, else `afterLogin` | open redirect | research |
| DB handle | `getSharedDatabase(url)` in `@softure-ai/db` | one pool per process for all modules | research |

## Phase 1: Package, migration and server logic

**Discipline:** TDD (business and security rules).

- `foundation/db/src/shared.ts`: `getSharedDatabase(url)`, exported from `@softure-ai/db`; test.
- Copy `templates/package/` into `modules/auth/`, name `@softure-ai/auth`, exports `.`, `./server`,
  `./next`, `./proxy`, `./ui`; dependencies core, db, security, ui, zod; peers drizzle-orm, next,
  react; lockfile.
- `migrations/0001_create_users_and_sessions.sql`, `src/schema.ts`.
- `src/options.ts`, `src/index.ts` (`auth` via `defineModule`, `dependsOn: { security: "^0.0.0" }`,
  switch and env declared), `module.json`.
- `src/server/`: `password.ts`, `session-token.ts`, `switches.ts`, `register.ts`, `login.ts`,
  `sessions.ts`, `change-password.ts`, `validation.ts`.
- `src/contract.ts`: `AuthUser`, `AuthErrorCode`, results.
- Tests on PGlite for the research baseline.

## Phase 2: Next adapter, guard, UI and messages

**Discipline:** test-after (wiring and UI).

- `src/next/`: `context.ts` (config, shared db, system clock), `cookie.ts`, `current-user.ts`,
  `actions.ts` (`"use server"`), `pages.tsx`, `logout-button.tsx`, `route.ts`, `index.ts`.
- `src/proxy/index.ts`: `createAuthGuard`; `src/redirect.ts`: `toSafeNextPath`; `src/cookie-name.ts`.
- `src/ui/`: `auth-forms.tsx` (client), `form-state.ts`; `src/messages/` en + pl (titles, labels,
  links, every error code including the security and core ones).
- Tests: guard, cookie naming, safe next path, error message lookup, form rendering
  (happy-dom), UI architecture (no raw colours, no inline copy, every `sft:` class also used in
  `@softure-ai/ui`).
- README with the twelve sections.

## Phase 3: Example app and e2e

**Discipline:** test-after.

- Example app: dependency `@softure-ai/auth`; `auth({ routes: { afterLogin: "/account" } })` and the
  auth buckets in `softure.config.ts`; mounts `app/login/page.tsx`, `app/register/page.tsx`,
  `app/account/password/page.tsx`, `app/api/auth/session/route.ts`; `proxy.ts` with the guard on
  `/account`; an `app/account/page.tsx` showing the user and the logout button.
- `e2e/auth.spec.ts`: guard redirect, register with consent, logout, wrong and right login, login
  without JavaScript, session route, cookie attributes, change password ending another session,
  `login-account` rate limit, open-redirect fallback.
- `e2e/migrations.spec.ts` lists `auth 1`; remove `spikes/next-actions/`, its mounts, its e2e, its
  dependency and its ledger row; drop `spikes/*` from the workspaces.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Package, migration and server logic

#### Automated
- [ ] 1.1 Server baseline tests (register, login, sessions, change password, switches, passwords) pass on PGlite
- [ ] 1.2 `module.json` equals `toModuleJson(auth)` and the package passes `tests/repo/packages.test.ts`
- [ ] 1.3 `getSharedDatabase` returns one handle per URL
- [ ] 1.4 Gates green (typecheck, lint, test)

### Phase 2: Next adapter, guard, UI and messages

#### Automated
- [ ] 2.1 Guard, cookie, next-path and form tests pass
- [ ] 2.2 UI architecture test passes and pl and en dictionaries have the same keys
- [ ] 2.3 `npm run build` emits `dist/next/actions.js` starting with `"use server"` and `dist/ui/auth-forms.js` with `"use client"`
- [ ] 2.4 Gates green (typecheck, lint, test, build)

### Phase 3: Example app and e2e

#### Automated
- [ ] 3.1 `npm run e2e` passes against a local PostgreSQL 16, including `auth.spec.ts`
- [ ] 3.2 Gates green (typecheck, lint, test)

#### Manual
- [ ] 3.3 Screenshots of the login, register and change-password pages look like the rest of the example (checked by the agent)
