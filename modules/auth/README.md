# @softure-ai/auth

Accounts for a Next.js app: register with a required consent, login, logout, password change,
database sessions, a route guard for `proxy.ts`, and ready pages and forms. The reference module
of the SOFTURE standard (docs/02): it has every layer, from migrations to messages. Built from
FIRE_TRACKER's auth (`src/lib/{password,session}.ts`, `src/db/sessions.ts`,
`src/app/actions/do-auth.ts`, `src/proxy.ts`), with the rate limiter of `@softure-ai/security`
and the route guard separated from channel tagging.

## 1. What it provides

Users and sessions in the `auth` schema, scrypt password hashes, opaque session cookies, register,
login, logout and password change as server actions and pages, `getCurrentUser` / `requireUser`
for server code, and `createAuthGuard` for the app's `proxy.ts`.

## 2. Installation

```bash
npm install @softure-ai/auth @softure-ai/security @softure-ai/core @softure-ai/db @softure-ai/ui drizzle-orm
```

Peer dependencies: `next` 16, `react` 19, `drizzle-orm`.

## 3. Configuration

```ts
import { defineSoftureConfig } from "@softure-ai/core";
import { registerSoftureConfig } from "@softure-ai/core/next";
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { cloudflareIp, security } from "@softure-ai/security";

const config = defineSoftureConfig({
  database: { url: process.env.DATABASE_URL! },
  locale: "pl",
  timezone: "Europe/Warsaw",
  appOrigin: process.env.APP_ORIGIN!,
  modules: [
    // auth counts attempts in these four buckets; change the numbers, keep the names.
    security({ clientIp: cloudflareIp(), buckets: { ...AUTH_RATE_LIMIT_BUCKETS } }),
    auth({
      routes: { afterLogin: "/dashboard" },
      password: { minLength: 12 },
      onRegistered: async ({ user, consent }, ctx) => {
        // Runs in the registration transaction: throw to roll the account back.
      },
    }),
  ],
});

registerSoftureConfig(config);
export default config;
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `password.minLength` | `number` (8-128) | `10` | Shortest new password, in characters. The longest is 1024. |
| `password.scrypt` | `{ cost, blockSize, parallelization }` | `{ 2 ** 17, 8, 1 }` | scrypt N, r, p (OWASP). Raising them rehashes each password at its owner's next login. |
| `session.ttlDays` | `number` (1-365) | `30` | Session lifetime from login. It is not extended by use. |
| `cookie.name` | `string` | `"softure_session"` | Base name of the session cookie (see below). |
| `cookie.domain` | `string` | none (host-only) | Share the session with subdomains, e.g. `example.com` for the apex and `app.example.com`. |
| `cookie.secure` | `boolean` | `appOrigin` is https | Send the cookie over HTTPS only. |
| `requireConsent` | `boolean` | `true` | Registration needs the consent checkbox. |
| `registrationClosed` | `boolean` | `false` | Declared default of the `auth.registration_closed` switch. |
| `onRegistered` | `(event, ctx) => Promise<void>` | none | Called after the account is created, inside the same transaction. |
| `routes` | `{ login, register, changePassword, afterLogin, afterLogout }` | `/login`, `/register`, `/account/password`, `/`, `/login` | Where the pages are mounted and where users land. |
| `messages` | partial `pl` / `en` dictionaries | built in | Copy overrides (section 9). |

**Cookie.** Always `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` = the TTL. A secure cookie gets
the prefix browsers enforce: `__Host-softure_session` when it is host-only, `__Secure-softure_session`
with `cookie.domain`. Over plain HTTP (local development) it keeps the bare name.

**Rate limits** (`AUTH_RATE_LIMIT_BUCKETS`, configured in `security`): `register` 5 and `login` 50
per client address, `login-account` 10 per email, `change-password` 10 per user, each per 15
minutes. Attempts are counted before any password is hashed. A successful login forgets the
email's failed attempts, not the address's. A request whose client address cannot be resolved is
refused (`security.client_unidentified`); see the security README for resolvers.

## 4. Mounting

One line per file, owned by the app (docs/02 §8):

```ts
// app/login/page.tsx
export { LoginPage as default } from "@softure-ai/auth/next";
// app/register/page.tsx
export { RegisterPage as default } from "@softure-ai/auth/next";
// app/account/password/page.tsx
export { ChangePasswordPage as default } from "@softure-ai/auth/next";
// app/api/auth/session/route.ts: { user: { id, email } | null }, never cached
export { getSessionRoute as GET } from "@softure-ai/auth/next";
```

The server actions (`loginAction`, `registerAction`, `changePasswordAction`, `logoutAction`) need
no mounting. In your own pages and layouts:

```tsx
import { getCurrentUser, LogoutButton, requireUser } from "@softure-ai/auth/next";

export default async function AccountPage() {
  const user = await requireUser(); // redirects to the login page without a live session
  return (
    <main>
      <p>{user.email}</p>
      <LogoutButton />
    </main>
  );
}
```

`requireUser({ next: "/account" })` brings the user back after login; `getCurrentUser()` returns
the user or `null`. Both read the session once per request.

**Route guard.** `createAuthGuard` returns `(request) => Response | null`: a redirect to the login
page (with `?next=`) for a protected path without a session cookie, `null` otherwise. It only
checks that the cookie is present, so pages still call `requireUser`. It imports nothing from Next,
so it chains with other proxy pieces:

```ts
// proxy.ts
import { createAuthGuard } from "@softure-ai/auth/proxy";
import { NextResponse, type NextRequest } from "next/server";
import config from "./softure.config";

const guard = createAuthGuard(config, { protect: ["/account", "/dashboard"] });

export function proxy(request: NextRequest) {
  return guard(request) ?? NextResponse.next();
}
```

A protected prefix matches whole path segments (`/account` covers `/account/password`, not
`/accounting`). The change-password route is always protected. Redirects are built on `appOrigin`.

**Your own forms.** `@softure-ai/auth/ui` exports `LoginForm`, `RegisterForm` and
`ChangePasswordForm`; pass them the actions from `@softure-ai/auth/next`.

## 5. Migrations and tables

`softure migrate` applies `migrations/0001_create_users_and_sessions.sql` after security's.

- `auth.users(id uuid, email, password_hash, created_at, password_changed_at)`: the email is stored
  trimmed and lowercased (`CHECK`), unique; the hash must be a `scrypt$…` string.
- `auth.sessions(token_hash, user_id → users ON DELETE CASCADE, created_at, expires_at)`: only the
  sha256 of the cookie token is stored.

Your own tables reference `users.id` (exported as the Drizzle table `users`); keep app columns in
your own 1:1 table, never in `auth.users`. Expired sessions of a user are deleted at their next
login; `pruneSessions(ctx)` from `@softure-ai/auth/server` deletes all of them for a scheduled job.

## 6. Environment variables

| Name | Required | Meaning |
| --- | --- | --- |
| `SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED` | no | `true` / `1` closes registration, `false` / `0` opens it, over the declared default. Any other value closes it and logs the variable name. |

## 7. Switches

`auth.registration_closed`: when on, the register page shows a notice instead of the form and the
register action refuses with `auth.registration_closed`. Until `@softure-ai/feature-switches`
exists, its value is the `registrationClosed` option overridden by the env variable above.

## 8. Appearance

Pages and forms are built from `@softure-ai/ui` (Card, fields, Checkbox, Button) and use only its
compiled classes, so `@softure-ai/ui/styles.css` styles them and the `--sft-*` tokens theme them.
Each form takes `classNames` for its slots (`root`, `form`, `footer`, `link`, `notice`) and
`unstyled`; pages are server components you can replace with your own page around the forms.

## 9. Copy

`authMessages.en` and `authMessages.pl`, overridable per locale:
`auth({ messages: { en: { login: { title: "Sign in to Acme" } } } })`. Groups: `fields`, `login`,
`register`, `changePassword`, `logout`, and `errors.{auth,security,core}` keyed by the error code
(`auth.invalid_credentials` → `errors.auth.invalid_credentials`). `getAuthErrorMessage(messages, code)`
looks one up.

## 10. Hooks

`onRegistered({ user, consent }, ctx)`: after the user row is inserted, in the same transaction
(`ctx.db` is the transaction). `consent` is `{ acceptedAt }`, or `null` with
`requireConsent: false`. A thrown error rolls the registration back and the user sees a generic
failure. `privacy` (engagement roadmap) stores the consent through it.

## 11. GDPR

The module stores an email, a password hash and session rows. It does not take part in the GDPR
export or deletion yet (`privacy` flags are off); deleting a row in `auth.users` deletes its
sessions.

## 12. Limitations / known gaps

- Sessions have a fixed lifetime; there is no sliding renewal and no "remember me".
- No password reset (identity ID-5), roles (ID-4) or email verification.
- The guard checks cookie presence only; the session is verified by `requireUser`.
- A registration attempt reveals whether an email has an account (`auth.email_taken`); the
  `register` rate limit bounds how fast anyone can ask.
