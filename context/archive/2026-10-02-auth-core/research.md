# Research: auth-core

Input: change.md, backlog-input.md. Depth: deep (authentication). Sources: `foundation/core`,
`foundation/db`, `foundation/ui`, `modules/security`, `spikes/next-actions`, `examples/next-app`,
docs/01, docs/02, the PRD (FR-11, NFR-2, NFR-3, NFR-5, NFR-6) and the `modules/auth/README.md` stub.

FIRE_TRACKER was not read in this session: its clone was refused by the session's permission
policy. The facts this change needs from it are already recorded in this repository (the auth
README stub: scrypt with a 64-byte key and a 16-byte salt, `timingSafeEqual`, a dummy verification
for unknown emails, 30-day sessions keyed by a sha256 of a 32-byte token, `httpOnly` / `lax` /
`secure` cookies; docs/01: FIRE mixes the auth guard and channel tagging in `proxy.ts`; the
security research: FIRE's `register` bucket is 5 and `login` 50 per 15 minutes, password change
keys on the user). The baseline is therefore the behaviour list below, written from those facts,
not a port of FIRE's test files.

## Current state

- `modules/auth/` is a stub: README and empty `src/{server,next,ui,messages}`, `migrations/`,
  `tests/`. Not a workspace yet.
- Module contract: `defineModule` parses options with a zod schema; `getModule(config, id)` returns
  the enabled module with its parsed `options`, merged `messages` and `routes` (with the app's
  overrides applied). Server code takes `ModuleContext { db, clock, config }`.
- `@softure-ai/security/server`: `identifyClient(ctx, headers)` → `Ok<key>` or
  `security.client_unidentified`; `subjectKey(subject)`; `consumeRateLimit(ctx, { bucket, key })`
  → `Ok` or `security.rate_limited` with `retryAfterSeconds`; `resetRateLimit`. An unknown bucket
  throws, naming the configured ones.
- Next adapter shape (docs/02 §8, measured in ID-1): `"use server"` files in `src/next/` survive
  `tsc`; pages and route handlers mount by one-line re-exports; `getSoftureConfig()` reads the app's
  config. Nothing in core or db gives package code a database handle yet: the example app keeps its
  own handle in `lib/database.ts`.
- UI: `@softure-ai/ui` has `Card`, `TextField`, `PasswordField`, `Checkbox`, `Button`, `FormError`;
  fields take an explicit `error` and `defaultValue`. `ActionForm` wraps the action in a client
  function and catches every rejection, so a server-side `redirect()` inside it would surface as a
  form error, and the form does not work without JavaScript. Auth forms therefore use
  `useActionState` with the server action itself as the form action (progressive enhancement, and
  `redirect()` works with and without JavaScript).
- CSS: `@softure-ai/ui/styles.css` is compiled from `foundation/ui/src/ui` only. A class that auth
  writes and ui does not use compiles nowhere. Auth composes ui primitives and uses only layout
  classes that ui already uses; a test checks that.

## Answers to the roadmap unknowns

1. **How the route guard composes with other proxy pieces.** `@softure-ai/auth/proxy` exports
   `createAuthGuard(config, { protect })`, which returns `(request: Request) => Response | null`:
   a redirect to the login route (with `?next=`) for a protected path without a session cookie, and
   `null` otherwise. It imports nothing from Next (Web `Request` / `Response`), so pieces chain with
   `??`: `return guard(request) ?? tagChannel(request) ?? NextResponse.next()`. It checks only that
   the cookie is present (an optimistic check, no database in the proxy); pages and actions still
   call `requireUser`, which reads the session row. A separate entry point keeps React and the
   server actions out of the proxy bundle.
2. **Cookie naming and domain for apex + subdomain.** Options `cookie: { name, domain, secure }`.
   `secure` defaults to the scheme of `appOrigin`. The name gets the browser-enforced prefix that
   fits: `__Host-<name>` when secure without a domain (host-only, the default), `__Secure-<name>`
   when secure with `domain` (shared by the apex and its subdomains), and the bare name on plain
   HTTP (local development, the e2e). Always `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` = TTL.
3. **Reading switches before `feature-switches` exists.** The manifest declares
   `auth.registration_closed`; the module reads it through one function,
   `isRegistrationClosed(config, env)`: the env override `SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED`
   (`true`/`1` or `false`/`0`) wins over the declared default (option `registrationClosed`, default
   `false`). An unreadable env value fails closed (registration closed) and is logged. ID-6 replaces
   the body of that function with a lookup in `feature-switches`; callers do not change.

## Further decisions

- **Passwords.** scrypt from `node:crypto`, 16-byte salt, 64-byte key, compared with
  `timingSafeEqual`. Stored as `scrypt$<N>$<r>$<p>$<salt>$<key>` (base64url), so cost can rise later:
  a successful login with an older cost rehashes. Default cost N=2^17, r=8, p=1 (OWASP); option
  `password.scrypt` lowers it for tests. The password is NFC-normalised before hashing. Length:
  `password.minLength` (default 10, 8..128) up to a fixed 1024 characters. An unknown email runs a
  verification against a dummy hash of the same cost, so timing does not reveal accounts.
- **Emails** are trimmed and lowercased, at most 254 characters, validated with zod; the column has
  a `CHECK (email = lower(email))` and a unique constraint.
- **Sessions.** 32 random bytes (base64url) in the cookie; the row stores only the sha256 hex as
  its primary key, with `user_id` (cascade delete), `created_at`, `expires_at`. Fixed TTL
  (`session.ttlDays`, default 30): a server component cannot set cookies, so a sliding renewal
  could not move the cookie's `Max-Age`. Expired rows of a user are deleted at their next login;
  `pruneSessions(ctx)` deletes all of them for a scheduled job.
- **Register** runs in one transaction: insert the user (`ON CONFLICT DO NOTHING` → `auth.email_taken`),
  call `onRegistered({ user, consent }, txCtx)`, create the session. A failing hook rolls the
  registration back, so a consent that `privacy` could not store never leaves an account behind.
- **Rate limits** (buckets the app configures in `security`, defaults exported as
  `AUTH_RATE_LIMIT_BUCKETS`): `register` per client (5 / 15 min, FIRE), `login` per client
  (50 / 15 min, FIRE), `login-account` per email subject (10 / 15 min), `change-password` per user
  subject (10 / 15 min). Counted before hashing. A successful login resets `login-account` only.
- **Change password** needs the current session and the current password; the hash update and
  the deletion of every other session of the user run in one transaction.
- **Redirects.** `next` comes from the query string, so it is accepted only as a same-origin path
  (`/…`, not `//…` or `/\…`, no control characters); anything else falls back to `afterLogin`.
- **Database handle for package code.** `@softure-ai/db` gains `getSharedDatabase(url)`: one
  process-wide handle per URL on `globalThis` (`Symbol.for`), so every module's Next adapter shares
  a pool and `next dev` reloads do not open new ones. ID-7 (`ops`) needs the same for its health check.
- **Route handler.** `GET /api/auth/session` answers `{ user: { id, email } | null }` with
  `cache-control: no-store`, mounted as `export { getSessionRoute as GET } from "@softure-ai/auth/next"`
  (named exports leave room for ID-5's routes).
- **Spike removal.** Auth now ships a server action, a route handler and a page through the same
  paths, so `spikes/next-actions/`, its mount files, its e2e and its ledger row go (ID-1 notes).
  The measurements it made stay in docs/02 §8.
- **Frame skipped:** the outcome names user-visible results, research did not contradict the
  baseline, and the unknowns have one clearly cheaper answer each.

## Behaviour baseline (unit tests on PGlite)

Register: creates the user and a session; normalises the email; refuses a taken email, an invalid
email, a short or overlong password, a missing consent (unless `requireConsent: false`), a closed
registration (default, env on, env off over a closed default, unreadable env); calls the hook with
the user and the consent time inside the transaction and rolls back when it throws; counts the
`register` bucket before hashing and refuses when it is spent.
Login: accepts the right password; refuses a wrong password and an unknown email with the same
code; runs a dummy verification for unknown emails; refuses when `login` or `login-account` is
spent; resets `login-account` on success; deletes the user's expired sessions; rehashes an older
cost.
Sessions: the cookie token is 32 bytes; the row holds its sha256, never the token; a session is
found until `expires_at` and not after; logout deletes only that session.
Change password: refuses a wrong current password, a short new one, a missing session; updates the
hash; deletes every other session of the user and keeps the current one; counts `change-password`.
Guard: protected path without cookie → redirect with `next`; with cookie → `null`; unprotected →
`null`; prefix matching respects path segments.

## Risks

- scrypt at N=2^17 costs ~128 MiB and a few hundred milliseconds per hash; a login flood is cut
  by the rate limits before hashing. Unit tests use a low cost.
- Example app: adding auth and removing the spike changes `e2e/migrations.spec.ts` and
  `softure.config.ts`, which ID-7 also edits; merge `master` before the PR.
- The e2e must send `cf-connecting-ip` on every browser request (the example uses `cloudflareIp`),
  or login is refused as unidentified.
