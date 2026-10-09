# @softure-ai/auth

Accounts for a Next.js app: register with a required consent, login, logout, password change,
password reset by an emailed link, roles with admin-only surfaces that fail closed, database sessions, a route guard for `proxy.ts`, and ready pages and forms. The reference module
of the SOFTURE standard (docs/02): it has every layer, from migrations to messages. It counts
attempts with the rate limiter of `@softure-ai/security`, and its route guard is separate from
channel tagging.

## 1. What it provides

Users and sessions in the `auth` schema, scrypt password hashes, opaque session cookies, register,
login, logout, password change and password reset as server actions and pages, `getCurrentUser` / `requireUser`
for server code, roles (`requireRole`, `authorizeRole`, `hasRole`, and `grant-role` /
`revoke-role` scripts), account recovery (`revokeUserSessions` and a `set-temporary-password`
script), `createAuthGuard` for the app's `proxy.ts`, and a health check that
`GET /api/health` of `@softure-ai/ops` runs (every auth table answers, no rows read).
`@softure-ai/auth/mailing` sends password reset mails through `@softure-ai/mailing`
(`mailingResetSender()`). `@softure-ai/auth/testing` creates accounts directly in the database for
tests (`createTestAccount`, section 4, "Tests").

## 2. Installation

```bash
npm install @softure-ai/auth @softure-ai/security @softure-ai/core @softure-ai/db @softure-ai/ui drizzle-orm
# only for the ops scripts in @softure-ai/auth/scripts (section 4, "Roles" and "Account recovery"):
npm install @softure-ai/ops
```

Peer dependencies: `next` 16, `react` 19, `drizzle-orm`; optional: `@softure-ai/mailing` for
`@softure-ai/auth/mailing`, `@softure-ai/ops` for `@softure-ai/auth/scripts`. No other entry
imports them.

**Unit tests with Vitest.** `@softure-ai/auth/next` imports `next/headers`, `next/navigation` and
`next/server` without a file extension. Next's bundler resolves only those bare specifiers (the `.js`
form bypasses its per-runtime aliases and breaks `next build`), but Next has no `exports` map, so plain
Node ESM cannot resolve them: a Vitest test that imports the entry fails with
`Cannot find module '…/node_modules/next/headers'`. Let Vitest process the package instead of Node:

```ts
// vitest.config.mts
export default defineConfig({ test: { server: { deps: { inline: [/@softure-ai\//] } } } });
```

The pattern covers every `@softure-ai/*` package; the other modules' `/next` entries import Next the
same way.

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
    // auth counts attempts in these buckets; change the numbers, keep the names.
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
| `password.scrypt` | `{ cost, blockSize, parallelization }` | `{ 2 ** 17, 8, 1 }` | scrypt N, r, p (OWASP). Raising them rehashes each password at its owner's next login. Memory: 128 × N × r bytes per hash, so the default takes 128 MiB and about 0.4 s of one core; Node runs up to four hashes at once (its libuv pool, `UV_THREADPOOL_SIZE`), about 512 MiB at a burst of logins. On a small server, lower `cost` to `2 ** 16` (64 MiB) or `2 ** 15` (32 MiB) and leave the pool at four. |
| `session.ttlDays` | `number` (1-365) | `30` | Session lifetime from login. It is not extended by use. |
| `cookie.name` | `string` | `"softure_session"` | Base name of the session cookie (see below). |
| `cookie.domain` | `string` | none (host-only) | Share the session with subdomains, e.g. `example.com` for the apex and `app.example.com`. |
| `cookie.secure` | `boolean` | `appOrigin` is https | Send the cookie over HTTPS only. Set it explicitly when one build serves both HTTPS and plain HTTP (see below). |
| `requireConsent` | `boolean` | `true` | Registration needs the consent checkbox. |
| `registrationFields` | `string[]` | `[]` | Extra register form fields handed to `onRegistered` as `event.fields` (section 10). Names: `a-z` first, then letters, digits or `_`, at most 32; not `email`, `password`, `next` or `consent`. |
| `legacySession` | `{ cookieName, tokenPattern }` | none | Sessions of the system the app took over (section 5, "Adopting existing sessions"). |
| `registrationClosed` | `boolean` | `false` | Declared default of the `auth.registration_closed` switch. |
| `roles` | `string[]` | `[]` | Role names the app checks besides `admin` (always declared): `a-z`, `0-9`, `_`, `-`, at most 32. |
| `adminEmails` | `string[] \| string` | `[]` | Initial admin list: while an email is listed, its account holds `admin`. Auth does not verify emails, so create these accounts before you deploy the list (section 4, "Roles"). A list refuses an entry that is not an email at config load. A string is the raw environment value (`adminEmails: process.env.ADMIN_EMAILS ?? ""`): entries split on commas and whitespace, trimmed and lowercased; one that is not an email is dropped with one log line naming its position and grants nothing. |
| `onRegistered` | `(event, ctx) => Promise<void>` | none | Called after the account is created, inside the same transaction. |
| `rewriteRedirect` | `(path, { config, searchParams? }) => string \| Promise<string>` | none | Rewrites the path of every auth redirect: the actions' (login, sign-up, password reset, logout), the login and register pages' redirect of a signed-in visitor and `requireUser`'s redirect to login, e.g. `tagRedirect` from `@softure-ai/analytics/next`, which keeps the channel tag. A page passes its own `searchParams` (`URLSearchParams`; `requireUser` hands over the ones the page gives it); an action passes none, and during a page's render the `Referer` is the page before, not the page itself. A result that is not a path on this app, or an error, leaves auth's own path. |
| `passwordReset.send` | `(link, user, details) => Promise<void>` | none | Delivers reset links (section 4, "Password reset"). Without it password reset is off. |
| `passwordReset.ttlMinutes` | `number` (5-1440) | `60` | How long a reset link works. |
| `routes` | `{ login, register, changePassword, forgotPassword, resetPassword, afterLogin, afterLogout }` | `/login`, `/register`, `/account/password`, `/forgot-password`, `/reset-password`, `/`, `/login` | Where the pages are mounted and where users land. |
| `messages` | partial `pl` / `en` dictionaries | built in | Copy overrides (section 9). |

**Cookie.** Always `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` = the TTL. A secure cookie gets
the prefix browsers enforce: `__Host-softure_session` when it is host-only, `__Secure-softure_session`
with `cookie.domain`. Over plain HTTP (local development) it keeps the bare name. Without
`cookie.secure` the choice follows `appOrigin`'s scheme, read once from the config: an image built
with an `https:` origin and run over plain HTTP (a test stack on the production image) sets a
`__Host-` cookie the browser refuses, so no login sticks. Set `cookie.secure` from the deploy instead,
e.g. `cookie: { secure: process.env.ALLOW_INSECURE_COOKIES !== "true" }` with the variable set on
that stack only.

**Rate limits** (`AUTH_RATE_LIMIT_BUCKETS`, configured in `security`): `register` 5 and `login` 50
per client address, `login-account` 10 per email, `change-password` 10 per user,
`password-reset` 10 (link requests) and `password-reset-confirm` 10 (new passwords) per client
address, `password-reset-account` 3 per email (the mails one address can get), each per 15
minutes. Attempts are counted before any password is hashed. A successful login forgets the
email's failed attempts, not the address's: the per-address `login` bucket counts every login,
successful or not, so a test suite that logs in many times from one address must raise `login`
(or give each test its own address). `login-account` is a lockout by design: ten wrong
passwords for one email, from any addresses, block logins to that account for the rest of the
window, the owner's included. Raise its limit if that trade-off is wrong for your app. Auth checks
at its first call that the buckets it counts in exist and names the missing ones: the three
`password-reset*` buckets only when `passwordReset.send` is set. A request whose client address
cannot be resolved is refused (`security.client_unidentified`); the security README shows resolver
chains for production and for development and test stacks.

## 4. Mounting

One line per file, owned by the app (docs/02 §8):

```ts
// app/login/page.tsx
export { LoginPage as default } from "@softure-ai/auth/next";
// app/register/page.tsx
export { RegisterPage as default } from "@softure-ai/auth/next";
// app/account/password/page.tsx
export { ChangePasswordPage as default } from "@softure-ai/auth/next";
// app/forgot-password/page.tsx and app/reset-password/page.tsx (with passwordReset.send)
export { ForgotPasswordPage as default } from "@softure-ai/auth/next";
export { ResetPasswordPage as default } from "@softure-ai/auth/next";
// app/api/auth/session/route.ts: { user: { id, email } | null }, never cached
export { getSessionRoute as GET } from "@softure-ai/auth/next";
```

The register page takes a consent label (links to your terms) and inputs of your own through
`createRegisterPage`, so you keep the module's page:

```tsx
// app/register/page.tsx
import { createRegisterPage } from "@softure-ai/auth/next";

export default createRegisterPage({
  consentLabel: (
    <>
      I accept the <a href="/terms">terms</a> and the <a href="/privacy">privacy policy</a>.
    </>
  ),
  extraFields: <input type="hidden" name="plan" value="pro" />,
});
```

A field reaches `onRegistered` only when its name is in `auth({ registrationFields })` (section 10).
The page also carries a declared field from its own URL as a hidden input, so with
`registrationFields: ["z"]` a visit to `/register?z=newsletter` hands `{ z: "newsletter" }` to the hook.

The server actions (`loginAction`, `registerAction`, `changePasswordAction`, `forgotPasswordAction`,
`resetPasswordAction`, `logoutAction`) need no mounting. In your own pages and layouts:

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

`<LogoutButton next="/login?next=…" />` (or `logoutAction({ next })` from the app's own action)
ends the session and goes to that path instead of `afterLogout`, e.g. a consent screen's "sign in as
someone else" returning to the same authorization request after the new login. The path is checked
like login's `next`: anything but a path on this app falls back to `afterLogout`.

`requireUser({ next: "/account" })` brings the user back after login; `getCurrentUser()` returns
the user or `null`. Both read the session once per request. The redirect to login goes through the
app's `rewriteRedirect` (options table); a page outside the proxy's guard passes its own search
params so the login URL can keep its channel tag:

```tsx
export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser({ next: "/settings", searchParams: await searchParams });
  // …
}
```

Private prefixes still belong behind the route guard below; the option covers the pages outside it
(billing's payment page passes its parameters).

**Route guard.** `createAuthGuard` returns `(request) => Response | null`: a redirect to the login
page (with `?next=`) for a protected path without a session cookie, `null` otherwise. It only
checks that the cookie is present, so **every private page and action still calls
`requireUser`**: the guard is a convenience, not the access check. Paths are compared decoded and
lowercased (`/%61ccount` and `/ACCOUNT` are guarded like `/account`). It imports nothing from Next,
so it chains with other proxy pieces:

```ts
// proxy.ts
import { createAuthGuard } from "@softure-ai/auth/proxy";
import { NextResponse, type NextRequest } from "next/server";
import softureConfig from "./softure.config";

const guard = createAuthGuard(softureConfig, { protect: ["/account", "/dashboard"] });

export function proxy(request: NextRequest) {
  return guard(request) ?? NextResponse.next();
}

// Static files never need the guard.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
```

(Name the imported SOFTURE config differently, e.g. `softureConfig`, when `proxy.ts` also exports
Next's `config`.)

A protected prefix matches whole path segments (`/account` covers `/account/password`, not
`/accounting`). The change-password route is always protected. Redirects are built on `appOrigin`,
because behind a reverse proxy the request URL carries the server's internal host.

An app served on several hosts from one build (the product on `app.example.com`, pages on
`example.com`) lists the others in the config's `origins.trustedOrigins` (read by every module), so a
visitor is sent to the login page on the host they used. The guard's own `trustedOrigins` option adds
origins for the guard alone:

```ts
defineSoftureConfig({ appOrigin: "https://app.example.com", origins: { trustedOrigins: ["https://example.com"] }, ... });
const guard = createAuthGuard(softureConfig, { protect: ["/account"] });
```

The guard builds the redirect on core's `resolveAppOrigin` (core README, "Request origins"): the
request's public origin from `X-Forwarded-Proto` and `X-Forwarded-Host` (first values), else from
`Host` and the URL's scheme, used only when it equals a listed origin (scheme, host and port); any
other request goes to `appOrigin` (or, with `origins.trustRequestHost`, to the `Host` origin). Headers alone can therefore never
send a visitor to a host the app did not list. An entry that is not an `http(s)` origin throws when
the guard is created. A session cookie shared by the hosts needs `cookie.domain`.

An app that is private by default protects `"/"` and lists its public paths in `exclude`, which is
checked first:

```ts
const guard = createAuthGuard(softureConfig, { protect: ["/"], exclude: ["/", "/pricing", "/blog", "/api/public"] });
```

In `exclude`, `"/"` is the home page only; any other entry matches whole segments like `protect`.
An app that keeps an exact allowlist instead lists the paths in `excludeExact`: `/pricing` there lets
`/pricing` and `/pricing/` through and guards `/pricing/plans`.
Auth's own public pages (login, register, forgot and reset password) and `/api/auth/session` are
never guarded, so `protect: ["/"]` cannot send the login page to itself. The change-password route
stays guarded even under an excluded prefix.

A stack the config cannot list (an integration run on a random port, a host added at deploy time)
sets `redirect: "relative"`: the `Location` is the path only (`/login?next=%2Faccount`), so the browser
stays on the host and port it used and no request header is read. An app whose image serves hosts it
does not know in advance can instead set the config's `origins.trustRequestHost` (core README).

**Roles.** A role is a declared name (`admin`, plus `auth({ roles: ["editor"] })`) held by an
account: as a row in `auth.user_roles`, or, for `admin` only, through `adminEmails`. Nothing is
granted by default: with no admin listed and no rows, every admin-only surface stays closed.

```tsx
import { ADMIN_ROLE } from "@softure-ai/auth";
import { authorizeRole, hasRole, requireRole } from "@softure-ai/auth/next";

// app/admin/page.tsx (pages, layouts and route handlers)
export default async function AdminPage() {
  await requireRole(ADMIN_ROLE); // anyone without the role, signed in or not: Next's "not found"
  return <main>…</main>;
}

// a server action: check first, before reading the form
export async function publishAction(formData: FormData) {
  const admin = await authorizeRole(ADMIN_ROLE); // Ok<AuthUser> or Err<"auth.forbidden">
  if (!admin.ok) return admin;
  // …
}

// UI only, e.g. whether to show a link; the target page checks again
const showAdminLink = await hasRole(ADMIN_ROLE);
```

Roles are read once per request and never cached across requests or stored in the cookie, so a
revoke takes effect on the next request. Asking for a role the app did not declare throws: a typo
fails loudly instead of quietly closing (or opening) a surface. Keep admin paths out of the proxy
guard's `protect` list, or anonymous visitors are sent to the login page instead of "not found".

**The first admin.** Either list the email in `adminEmails` (register that account yourself
before the list is deployed, or keep registration closed meanwhile: whoever registers a listed email
first becomes admin), or, safer, grant the role with the ops script, which needs database access:

```ts
// scripts/grant-role.ts (bundled and run like the migrate step, @softure-ai/ops README)
import { createGrantRoleScript } from "@softure-ai/auth/scripts";
import { runOpsScript } from "@softure-ai/ops/scripts";
import config from "../softure.config";

process.exitCode = await runOpsScript({ script: createGrantRoleScript(config), argv: process.argv.slice(2), config });
```

`node grant-role.mjs --email=owner@example.com --role=admin` prints the account's roles before and
after (by user id, never the email) and rolls back; `--commit` writes. `createRevokeRoleScript`
is its pair. Both refuse an unknown email, an undeclared role, a role already granted (grant) or
not stored (revoke); an `admin` that comes from `adminEmails` is removed from the list, not by the
script. `grantRole`, `revokeRole` and `findUserRoles` in `@softure-ai/auth/server` do the same for
your own code.

**Account recovery.** `revokeUserSessions(ctx, userId, { except? })` from `@softure-ai/auth/server`
ends every session of an account (all but `except`) and returns how many; each device logs in
again. For an owner who lost access without a reset mail, the `set-temporary-password` ops script
sets a random password (at least 20 characters, and at least `password.minLength`), ends every
session and the pending reset link, and prints the password once:

```ts
// scripts/set-temporary-password.ts (bundled and run like grant-role)
import { createSetTemporaryPasswordScript } from "@softure-ai/auth/scripts";
import { runOpsScript } from "@softure-ai/ops/scripts";
import config from "../softure.config";

process.exitCode = await runOpsScript({ script: createSetTemporaryPasswordScript(config), argv: process.argv.slice(2), config });
```

`node set-temporary-password.mjs --email=owner@example.com` shows what it would end and rolls back
(the printed password is not stored); `--commit` writes and prints the password to hand over. Send
it only to the account's own address, and ask the owner to change it after logging in: the module
does not force a change. `createSetTemporaryPasswordScript(config, { alphabet: READABLE_PASSWORD_ALPHABET })`
draws the password from 57 letters and digits without `0/O`, `1/l/I`, `-` and `_`, for a password
someone dictates or types from a mail.

To keep the plain password off the server, make it and its hash on your own machine and give the
script only the hash. `createTemporaryPassword({ alphabet, length })`, `hashPassword` and
`getAuthOptions` come from `@softure-ai/auth/server`; with a given hash the length rule is yours, so
use at least `password.minLength` and 20:

```ts
// scripts/temporary-password-hash.ts, run locally
import { createTemporaryPassword, getAuthOptions, hashPassword, READABLE_PASSWORD_ALPHABET } from "@softure-ai/auth/server";
import config from "../softure.config";

const { password } = getAuthOptions(config);
const plain = createTemporaryPassword({ alphabet: READABLE_PASSWORD_ALPHABET, length: Math.max(password.minLength, 20) });
console.error(`password to hand over: ${plain}`);
console.log(await hashPassword(plain, password.scrypt));
```

```sh
node temporary-password-hash.mjs | ssh app-host docker exec -i app node set-temporary-password.mjs --email=owner@example.com --password-hash-file=- --commit
```

`--password-hash-file=-` reads the hash from stdin (`--password-hash=<hash>` works too, but lands in
shell history). The script refuses a value that is not a `hashPassword` hash without printing it,
stores the hash, ends the sessions and the reset link as before, and reports `passwordFrom: "hash"`
instead of a password. A hash made with other scrypt parameters than the config's is rehashed at
the first login. `isPasswordHash(value)` checks the format locally, exactly: a hash cut or padded in transport,
a character outside base64url or a cost scrypt refuses is not a hash `hashPassword` writes, so the script refuses it
instead of storing a hash no password matches.

**Password reset.** Pass a sender, and the login form links to the request page. With
`@softure-ai/mailing` enabled, `mailingResetSender()` is that sender:

```ts
import { auth } from "@softure-ai/auth";
import { mailingResetSender } from "@softure-ai/auth/mailing";
import { mailing, resend } from "@softure-ai/mailing";

modules: [
  auth({ passwordReset: { send: mailingResetSender() } }),
  mailing({ from: "Acme <hello@mail.acme.com>", provider: resend() }),
];
```

It mails the account's address in the app's locale: subject, a plain-text body with the link and an
HTML body with it as an anchor, from `resetMail` in the dictionaries (section 9), with how long the
link works (`ttlMinutes`, in the locale's plural form). It is a transactional mail: no unsubscribe
link. It reads the registered config (`registerSoftureConfig`) when it runs; a failed send
(`mailing.rejected`, `mailing.unavailable`, or mailing not enabled) is logged like any sender error.
`renderPasswordResetMail(messages, locale, { link, ttlMinutes })` renders the same mail for an app
that sends it another way. Any other sender works too:

```ts
import { auth, consolePasswordResetSender } from "@softure-ai/auth";

auth({
  passwordReset: {
    // link: `${appOrigin}/reset-password?token=…`; details: { expiresAt, locale }
    send: async (link, user, details) => {
      await mailer.send({ to: user.email, template: "password-reset", data: { link, expiresAt: details.expiresAt }, locale: details.locale });
    },
    // in development only: send: consolePasswordResetSender (it refuses under NODE_ENV=production)
  },
});
```

- The request page answers the same for every email: the link is issued and the sender runs after
  the response (Next's `after()`), so neither its time nor a failure shows. A sender error is logged
  without the link. `password-reset-account` bounds how many links one address can receive.
- A link carries 32 random bytes; only their sha256 is stored. One link per account is pending: a
  new request replaces it. It works for `ttlMinutes`, once. Opening it only checks it (mail scanners
  open links too); submitting the new password consumes it, sets the password, ends **every**
  session of the account and sends the user to the login page, which confirms the change.
- A normal password change cancels a pending link.
- The link is built on `appOrigin`, never on the request's Host header. A multi-host app keeps the
  link's path and query and swaps the origin in its sender, from what it knows about the user.
- The reset page's referrer policy is `same-origin`, so the token in its URL never reaches another
  site. It still lands in your own access logs; it works once and expires.
- `requestPasswordReset`, `deliverPasswordReset`, `resetPassword`, `findPasswordResetUser` and
  `prunePasswordResets` in `@softure-ai/auth/server` do the same for your own flows.

**Your own forms.** `@softure-ai/auth/ui` exports `LoginForm`, `RegisterForm`,
`ChangePasswordForm`, `ForgotPasswordForm` and `ResetPasswordForm`; pass them the actions from
`@softure-ai/auth/next`. `RegisterForm` takes `consentLabel` and `extraFields` like
`createRegisterPage`.

**Tests.** `createTestAccount(db, { email, password, roles?, scrypt? })` from `@softure-ai/auth/testing`
writes an account and its role rows in one transaction, hashed as registration hashes it, and returns
the `AuthUser`. It is for tests that need an account but are not about registration: no session is
opened, so the test signs in through the login form. One password with one set of parameters is hashed
once per test run. Pass the app's parameters, so the first login does not rehash:

```ts
import { getAuthOptions } from "@softure-ai/auth/server";
import { createTestAccount } from "@softure-ai/auth/testing";

const user = await createTestAccount(handle.db, {
  email: "ada@example.com",
  password: "correct horse battery",
  roles: ["admin"],
  scrypt: getAuthOptions(config).password.scrypt,
});
```

A fixture account takes more, with a module context (`{ db, clock, config }`) instead of the database:

```ts
const user = await createTestAccount(ctx, {
  id: "0b9f5a0e-3c1d-4f6e-9a2b-7c8d9e0f1a2b",
  email: "ada@example.com",
  passwordHash: FIXTURE_HASH, // from hashPassword, stored as is: nothing is hashed
  createdAt: new Date("2025-01-02T03:04:05Z"),
  runHooks: true, // the app's onRegistered runs in the account's transaction
  fields: { channel: "newsletter" }, // event.fields for the hook
});
```

With a context and no `scrypt`, a `password` is hashed with the app's parameters. `runHooks` hands the
hook a consent accepted at `createdAt` (null when `requireConsent` is off); it needs the context and
throws with a bare database. An invalid or taken email, a `passwordHash` that is not a module hash or a
hook that throws rolls everything back and throws. The entry is server-only and never imported by the
module itself.

## 5. Migrations and tables

`softure migrate` applies `migrations/0001_create_users_and_sessions.sql`,
`0002_create_user_roles.sql`, `0003_create_password_resets.sql` and
`0004_index_users_created_at.sql` (an index on `users.created_at` for billing's reminder mail)
after security's.

- `auth.users(id uuid, email, password_hash, created_at, password_changed_at)`: the email is stored
  trimmed and lowercased (`CHECK`), unique; the hash must be a `scrypt$…` string.
- `auth.sessions(token_hash, user_id → users ON DELETE CASCADE, created_at, expires_at)`: only the
  sha256 of the cookie token is stored.
- `auth.user_roles(user_id → users ON DELETE CASCADE, role, granted_at)`, primary key
  `(user_id, role)`; the role name has the declared shape (`CHECK`).
- `auth.password_resets(user_id → users ON DELETE CASCADE, token_hash, created_at, expires_at)`,
  primary key `user_id` (one pending link per account), unique `token_hash` (sha256 only).

Your own tables reference `users.id` (exported as the Drizzle table `users`; roles as `userRoles`); keep app columns in
your own 1:1 table, never in `auth.users`. Expired sessions of a user are deleted at their next
login; `pruneSessions(ctx)` from `@softure-ai/auth/server` deletes all of them for a scheduled job,
and `prunePasswordResets(ctx)` does the same for expired reset links.

**Adopting existing sessions.** An app that moves to this module from its own auth can keep its
users, its password hashes when they are `scrypt$N$r$p$salt$key` strings, and its sessions when it
stored them as the sha256 hex of the token. Its cookie has another name and its tokens another
shape, so without more every user logs in once after the switch. To keep them signed in, declare
the old cookie:

```ts
auth({ legacySession: { cookieName: "session", tokenPattern: /[0-9a-f]{64}/ } });
```

`tokenPattern` describes the whole token (the module anchors it) and must not use the `g` or `y`
flag. While the current cookie is absent the old one is read, its token looked up by the same
sha256, and the route guard counts it. The next login, register or logout ends that session and
removes the old cookie (`Path=/` and `cookie.domain`; an old cookie set on another path or domain
stays until it expires, its session already ended). Legacy sessions keep their own expiry. Remove
the option once the longest of them has expired.

A password hashed from input that was not NFC still verifies: a login tries the input as given when
its NFC form fails, then rehashes it in NFC.

## 6. Environment variables

| Name | Required | Meaning |
| --- | --- | --- |
| `SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED` | no | `true` / `1` closes registration, `false` / `0` opens it, over the declared default. Any other value closes it and logs the variable name. When the app defines the switch in `@softure-ai/feature-switches`, that module reads this variable by its own rules (`on` / `off` too; an unreadable value gives the fail mode). |

## 7. Switches

`auth.registration_closed`: when on, the register page shows a notice instead of the form, the
login page drops its register link, and the register action refuses with `auth.registration_closed`.

Auth reads it through `readSwitch` of `@softure-ai/core`. When the app defines it in
`@softure-ai/feature-switches`, the switches panel flips it and the stored value applies from the
next request (environment override, stored value, default, fail mode, as that module resolves
them). Define it with `failMode: "open"`, so a failed read keeps registration closed:

```ts
featureSwitches({
  switches: [{ name: REGISTRATION_CLOSED_SWITCH, label: { en: "Registration closed" }, default: false, failMode: "open" }],
}),
```

Without feature-switches, or while the app does not define the switch there, its value is the
`registrationClosed` option overridden by the env variable above. `isRegistrationClosed(ctx)` from
`@softure-ai/auth/server` is async and gives the same answer the pages and the action use.

## 8. Appearance

Pages and forms are built from `@softure-ai/ui` (Card, fields, Checkbox, Button) and use only its
compiled classes, so `@softure-ai/ui/styles.css` styles them and the `--sft-*` tokens theme them.
Each form takes `classNames` for its slots (`root`, `form`, `footer`, `link`, `notice`, and `submit`
for the submit button's class), `submitVariant` (a `Button` variant, `primary` by default) and
`unstyled`; pages are server components you can replace with your own page around the forms.

## 9. Copy

`authMessages.en` and `authMessages.pl`, overridable per locale:
`auth({ messages: { en: { login: { title: "Sign in to Acme" } } } })`. Groups: `fields`, `login`,
`register`, `changePassword`, `forgotPassword`, `resetPassword`, `resetMail` (the reset mail of
`mailingResetSender()`; `minutes` holds plural forms), `logout`, and `errors.{auth,security,core}` keyed by the error code
(`auth.invalid_credentials` → `errors.auth.invalid_credentials`). `getAuthErrorMessage(messages, code)`
looks one up.

## 10. Hooks

`onRegistered({ user, consent, fields }, ctx)`: after the user row is inserted, in the same
transaction (`ctx.db` is the transaction). `consent` is `{ acceptedAt }`, or `null` with
`requireConsent: false`. `fields` holds the declared `registrationFields` the form sent, by name
(strings cut to 512 characters, empty ones left out). They come from the client, and a link can set
a carried one, so validate them before you store them. The hook runs inside the register action,
so it can also read the request (`headers()`, `cookies()` from `next/headers`). A thrown error rolls the registration back and the user sees a generic
failure. `@softure-ai/privacy` stores the consent through it.

`passwordReset.send(link, user, details)`: after a reset request is answered, for an existing
account only (section 4, "Password reset"). `mailingResetSender()` from `@softure-ai/auth/mailing`
plugs `@softure-ai/mailing` in here.

## 11. GDPR

The module stores an email, a password hash, session rows, role rows and pending reset rows. It
contributes to `@softure-ai/privacy` (`privacy` flags on):

- **Export** (`exportAuthUserData`): the account (id, email, `createdAt`, `passwordChangedAt`),
  stored roles with their grant dates, sessions (created and expiry dates) and a pending reset link
  (created and expiry dates). Never the password hash or a token hash. A role held through
  `adminEmails` is configuration, so it is not in the export.
- **Deletion** (`deleteAuthUserData`): the user's sessions, pending reset, roles and then the
  account row, so every session ends with the account. Privacy runs auth after the modules that
  depend on it, and the app's contributors before all modules.

`isCurrentPassword(ctx, userId, password)` (`/server`) checks the password again before an action
that cannot be undone, such as the account deletion; the caller counts the attempt first.

Rate limit rows of `security` hold only SHA-256 prefixes of the email and user id
(`subjectKey`), pruned two windows after they start; they are not exported or deleted.

## 12. Limitations / known gaps

- Sessions have a fixed lifetime; there is no sliding renewal and no "remember me".
- A password change keeps the session that made it (and ends every other one); the token itself
  is not rotated. The new password must differ from the current one (`auth.password_unchanged`). Login and register end the session the browser held before.
- No email verification, so `adminEmails` trusts whoever registers a listed email first. (A reset
  link goes to the account's email, so its owner can take the account back.)
- Roles are flat: no hierarchy and no permissions per role; no UI to manage them (the scripts do).
- The guard checks cookie presence only; the session is verified by `requireUser`.
- A `next` path longer than 8192 characters is replaced by the default target, with a warning in
  the log that names its length.
- A temporary password from the script is not forced to change at the next login.
- A registration attempt reveals whether an email has an account (`auth.email_taken`); the
  `register` rate limit bounds how fast anyone can ask.
