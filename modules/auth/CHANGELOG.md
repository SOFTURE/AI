# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/auth`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`auth@x.y.z`).

## Unreleased

- `LogoutForm` in `@softure-ai/auth/ui` (#874): the sign-out form as a client component taking the logout action, with
  an optional `beforeSignOut` awaited before the sign-out (e.g. `clearDeviceData` of `@softure-ai/pwa`); its failure
  is logged by kind and the sign-out goes on. `LogoutButton` renders it, with the same props and markup as before.

## 0.2.10

- The GitHub sign-in example and the `clientIdEnv`/`clientSecretEnv` hints name `GH_AUTH_CLIENT_ID` and
  `GH_AUTH_CLIENT_SECRET` (#846): GitHub Actions refuses secret names that start with `GITHUB_`. Any name still parses.

## 0.2.9

- Sign in with GitHub (#840): a provider entry `{ type: "github", id, name, clientIdEnv, clientSecretEnv,
  allowedEmails | allowedDomains }` in `oidc.providers`. GitHub is an OAuth App, not OpenID Connect: the endpoints are
  fixed, and the account is read from GitHub's API (`/user`, `/user/emails`) with an access token that is never
  stored. The subject is the numeric account id; only verified emails count, primary first. Everything else is the
  OpenID Connect sign-in's: state, PKCE, cookie, `oidc-*` buckets, callback route, allowlist, `auth.identities`,
  linking, `onRegistered`, error codes. `createFakeGithubProvider` in `@softure-ai/auth/testing` tests it without
  network. README section 3, "GitHub sign-in".
- Types: `OidcProvider` is now a union of `OpenIdConnectProvider` (`type: "oidc"`, the default for an entry without
  `type`) and `GithubProvider`; code that reads `provider.issuer` narrows on `type` first. The parsed options carry
  `type`. New exports: `OpenIdConnectProvider`, `OpenIdConnectProviderInput`, `GithubProvider`, `GithubProviderInput`.
- The allowlist message reads "a sign-in through a provider is limited to them".

No change for an app: existing entries parse as before, no migration, bucket, route or copy is added. Sign-in through
a provider stays opt-in.

## 0.2.8

- OpenID Connect stays opt-in, now stated and tested (#786). An app without `oidc.providers` runs none of it. On a bump
  past 0.2.5 such an app still gets two empty tables (`auth.identities`, `auth.oidc_states`, migration `0005`): a
  module's migrations are one numbered sequence and cannot depend on its options, and without a provider nothing
  writes to them. The `oidc-start` and `oidc-callback` buckets are required only with a provider; spreading
  `AUTH_RATE_LIMIT_BUCKETS` adds their definitions, which count nothing. A new test pins it: without a provider and
  without those buckets, registration and login work and no OpenID Connect row is written. README section 3,
  "Without a provider", lists it all.
- The 0.2.6 entry below is corrected: it called the release additive without naming migration `0005` or the copy
  keys that 0.2.6 required (optional since 0.2.7).

Steps for an app without a provider, from any version up to 0.2.5 to this one: run `softure migrate` (migrations
`0005` and `0006`). Nothing else: no copy, buckets, environment variables or routes to add.

## 0.2.7

- `AuthMessages`: the OpenID Connect keys (`oidc`, `errors.auth.oidc_failed`, `oidc_cancelled`, `oidc_not_allowed`,
  `oidc_no_account`) are optional (#786). In 0.2.6 they were required, so an app with its own dictionary typed
  `AuthMessages` stopped compiling, although that release was described as additive. A missing key reads the English
  copy: `OidcSignIn` falls back to `authMessages.en.oidc`, and `getAuthErrorMessage` to the English message of a known
  code before the dictionary's generic failure. No change for an app.
- `AuthUser.displayName` (`string | null`): the name an OpenID Connect provider sends (`name`, else `given_name`),
  stored on the account at every sign-in that carries one and kept when a sign-in carries none (#802). Null for a
  password account. Normalized (control characters dropped, whitespace collapsed, trimmed, at most 200 characters); a
  malformed claim is ignored. The property is optional in the type, so an app's own `AuthUser` literals keep
  compiling; the package always sets it.
- New column `auth.users.display_name` (migration `0006`, nullable, no rewrite). The privacy export lists
  `account.displayName`; the deletion removes it with the account.
- The OpenID Connect flow always requests the `profile` scope with `openid email`, so Google sends the name. Google
  shows it as part of the basic sign-in consent.
- `createFakeOidcProvider`: `FakeOidcUser` gains `name` and `givenName`.

Migration for an app: run `softure migrate` (migration `0006`). To show the signed-in user by name, read
`user.displayName ?? user.email`. Users who signed in before the release get their name at their next sign-in.

## 0.2.6

Sign in with an OpenID Connect provider (Google), limited to allowed domains or emails (#769). Opt-in, but not
additive for every app: an app without `oidc` runs migration `0005` (two tables it leaves empty), and an app with its
own dictionary typed `AuthMessages` must add the OpenID Connect copy keys (optional again in 0.2.7). The two new bucket
defaults are required only with a provider.

- `auth({ oidc: { providers: [{ id, name, issuer, clientIdEnv, clientSecretEnv, allowedDomains, allowedEmails,
  createAccounts, ... }] } })`: authorization code flow with PKCE S256, a one-time state bound to the browser by a
  short-lived cookie, a nonce, and the ID token verified against the issuer's JWKS (RS256, ES256). `email_verified`
  is required, then the allowlist; for Google a domain match also needs the `hd` claim (`requireHostedDomain`).
- New tables `auth.identities` (provider, subject → account; one per provider and account) and `auth.oidc_states`
  (migration `0005`). A first sign-in links the account with the same verified email or creates one without a usable
  password; later sign-ins find it by the provider's subject.
- `password: { enabled: false }`: only the provider buttons; login, registration, reset and password change refuse.
- `oidcSignInAction` and `oidcCallbackRoute` in `/next`, `OidcSignIn` in `/ui`, `startOidcSignIn` and
  `completeOidcSignIn` in `/server`, `createFakeOidcProvider` in `/testing`. `LoginPage` shows the buttons and the
  `?oidc_error=` message.
- `AUTH_RATE_LIMIT_BUCKETS` gains `oidc-start` and `oidc-callback` (20 per 15 minutes per client address), required
  only with a provider. New error codes `auth.oidc_failed`, `auth.oidc_cancelled`, `auth.oidc_not_allowed`,
  `auth.oidc_no_account`; new copy `oidc.signInWith`, `oidc.divider` and the four error messages.
- `RegisteredEvent` gains `oidcProvider` (`null` from the register form); `ChangePasswordErrorCode` gains
  `auth.forbidden`. The privacy export lists `identities`, and the deletion removes them.
- Needs `@softure-ai/core` `^0.2.4` (form bodies and error bodies of `requestJson`).

Migration for an app that wants Google-only sign-in (for example one behind Cloudflare Access today):

1. Run `softure migrate` (adds the two tables).
2. In Google Cloud, create an OAuth client of type "Web application" with the redirect URI
   `<APP_ORIGIN>/api/auth/oidc/google/callback`; for a Workspace-only app set the consent screen to "Internal".
3. Set `GOOGLE_AUTH_CLIENT_ID` and `GOOGLE_AUTH_CLIENT_SECRET` in every environment.
4. Add the provider to `auth({ oidc: { providers: [...] } })` with `issuer: "https://accounts.google.com"` and
   `allowedDomains` (and/or `allowedEmails`), and `password: { enabled: false }` to drop the password form.
5. Mount `app/api/auth/oidc/[provider]/callback/route.ts` with `export { oidcCallbackRoute as GET } from
   "@softure-ai/auth/next";`. The app's security buckets already have the new ones when it spreads
   `AUTH_RATE_LIMIT_BUCKETS`; otherwise add `oidc-start` and `oidc-callback`.
6. Sign in once: the existing owner account (same email) is linked, nothing else changes. Then the outer sign-in in
   front of the host (Cloudflare Access) and its bypass list can go, and the `create-account` password account and
   change-password page are no longer needed.

## 0.2.5

- The auth forms' submit button keeps its width while sending (#616): `LoginForm`, `RegisterForm`,
  `ChangePasswordForm`, `ForgotPasswordForm` and `ResetPasswordForm` pass their pending copy to ui's `Button` as
  `pendingLabel`, so the idle button reserves the longer label and the spinner sits in the label, as in ui's
  `ActionForm`. The label is now wrapped in ui's label spans; the button's root and its `submit` class are unchanged.
  Nothing to migrate.

## 0.2.4

All additive (#588); existing calls keep their fields, names and look.

- `RegisterForm`'s consent box shows `errors.auth.consent_required` under the box when a submit finds it unticked,
  instead of the browser's own bubble, and takes focus when it is the first invalid control; ticking it clears the
  message. It takes `consentProps` (`{ id, classNames }`, `ConsentProps`), so with `id: "field-consent"` the box is
  `#field-consent` and its error `#field-consent-error`.
- A server error for a field a form does not render (e.g. `consent` with `requireConsent={false}`) now shows as the
  form error instead of being dropped.
- Every form takes `fieldClassNames` (ui's `InputFieldSlot`s: `label`, `hint`, `input`, ...), `fieldHintAs` and
  `fieldHintProps`, passed to each of its text and password fields.

Migration for an app that turned the box off and rendered its own (`requireConsent={false}` plus a `CheckboxField`
in `extraFields`):

1. Drop `requireConsent={false}` and the app's consent box from `extraFields`; pass the statement as `consentLabel`.
2. Pass `consentProps={{ id: "field-consent" }}` (the id the app's tests use) and the box's classes in
   `consentProps.classNames`.
3. Pass the app's field look as `fieldClassNames` (e.g. `{ label: "…" }`) and, for "?" hints, `fieldHintAs="tooltip"`
   with `fieldHintProps`.
4. An app with its own translation already has `errors.auth.consent_required`; its wording is the box's message.

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
