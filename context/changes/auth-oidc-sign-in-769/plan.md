# Plan: auth-oidc-sign-in-769

Input: change.md, research.md

## Goal

OpenID Connect sign-in in `@softure-ai/auth`, off by default, limited to allowed domains or emails, with an option to
switch the password routes off, tested against a fake provider shipped in `@softure-ai/auth/testing`.

## Approach

OIDC client inside auth (`src/server/oidc/`): discovery and JWKS fetched through core's `requestJson` and cached per
config, ID token verified with `node:crypto`, a state table plus a browser-bound cookie, an identities table for the
`(provider, subject)` mapping, accounts created with an unusable password. The Next adapter gets one server action
(start) and one route handler (callback). Rejected: depending on connections (cycle), a JOSE dependency (node:crypto is
enough for RS256/ES256), a nullable password hash (touches every password path).

## Phase 1: options, tables, buckets, privacy

**Discipline:** TDD. **Files:** `src/options.ts`, `src/index.ts`, `module.json`, `src/schema.ts`,
`migrations/0005_create_identities_and_oidc_states.sql`, `src/server/rate-limits.ts`, `src/server/privacy.ts`,
`src/server/health.ts`, `src/contract.ts`, `package.json` (core `^0.2.4`), tests `module.test.ts`, `privacy.test.ts`.

- `oidc: { providers: [{ id, name, issuer, clientIdEnv, clientSecretEnv?, clientAuth, scopes, authorizeParams,
  allowedDomains, allowedEmails, requireHostedDomain?, createAccounts }], stateTtlMinutes, httpTimeoutMs, fetch? }`;
  refusals: no allowlist, repeated id, non-https issuer (http only on localhost). `password.enabled` (default true);
  false needs a provider.
- Migration: `identities (provider, subject) PK, user_id FK cascade, UNIQUE (user_id, provider), email, created_at,
  last_login_at`; `oidc_states (state_hash PK, provider, nonce, code_verifier, next_path, created_at, expires_at)`.
- `AUTH_RATE_LIMIT_BUCKETS` gains `oidc-start` and `oidc-callback` (per ip), required only with providers.
- Privacy exports and deletes identities; health checks both tables; manifest lists them and the callback mount.

Done when the option, migration and privacy tests pass.

## Phase 2: the OIDC flow and the fake provider

**Discipline:** TDD. **Files:** `src/server/oidc/{discovery,id-token,token-request,flow,accounts}.ts`,
`src/server/index.ts`, `src/testing/oidc-provider.ts`, `src/testing/index.ts`, tests `oidc-flow.test.ts`,
`oidc-id-token.test.ts`.

- `startOidcSignIn(ctx, { provider, next, clientKey })` → `{ url, state, maxAgeSeconds }`;
  `completeOidcSignIn(ctx, { provider, params, browserState, clientKey })` → `SignedIn & { next }` or a code
  (`auth.oidc_failed`, `auth.oidc_cancelled`, `auth.oidc_not_allowed`, `auth.oidc_no_account`, rate limit).
- Tests: happy path creates the account and identity; second sign-in reuses it after an email change; links an
  existing password account; refuses a not allowed domain, an unverified email, a Google account without `hd`, a
  wrong nonce, a wrong audience, an expired token, a bad signature, `alg: none`, a replayed or foreign state, a missing
  cookie; `createAccounts: false` without an account; key rotation (unknown `kid` refetches the JWKS once); provider
  outage; the rate limits; two concurrent first sign-ins create one account and one identity (plan review 1);
  discovered endpoints must be https (2); an unknown `kid` refetches at most once a minute (3).

## Phase 3: password switch-off and the Next adapter

**Discipline:** test-after for the Next glue, TDD for the server refusals. **Files:** `src/server/{login,register,
change-password,password-reset}.ts`, `src/next/{actions,route,pages,oidc-cookie,previous-session,index}.ts(x)`,
`src/ui/{oidc-sign-in,index}.tsx`, `src/proxy/index.ts`, `src/messages/en.ts`, tests `pages.test.tsx`, `guard.test.ts`,
`forms.test.tsx`, `login.test.ts`.

- `password.enabled: false`: `loginUser` → `auth.invalid_credentials`, `registerUser` → `auth.registration_closed`,
  reset off, change password `auth.forbidden`; register, forgot, reset and change-password pages are not found.
- `oidcSignInAction(formData)`: rate limit, state row, cookie, redirect to the provider; failures back to the login
  page with `?oidc_error=<code>`. `oidcCallbackRoute(request, { params })`: consumes the state, ends previous
  sessions, writes the session cookie, 303 to `next` (through `rewriteRedirect`).
- `OidcSignIn` (ui): one button per provider ("Sign in with {provider}"), an error line, a divider before the
  password form. The guard treats `/api/auth/oidc` as public.

## Phase 4: docs

README (Configuration, Mounting, Migrations, Environment, Limitations), CHANGELOG `## Unreleased` with the steps for
an app that wants Google-only sign-in.

## Risks and rollback

A wrong check in the ID token validation would let a stranger in: every refusal has its own test. The migration only
adds tables; rollback is in its header. Apps without `oidc` see no change besides two new bucket defaults.

## Decisions (auto)

- Button copy → `messages.oidc.signInWith` with the provider's `name`, instead of a per-locale `label` in the options
  (copy belongs in messages; an app overrides the message per locale).
- `requireHostedDomain` defaults to true for `https://accounts.google.com`, false otherwise (Google's own guidance).
- First sign-in links an existing account with the same verified email (the identity is verified and allowlisted);
  a user with another subject of that provider is refused (`auth.oidc_no_account`).
- `createAccounts` defaults to true; creation does not look at `registrationClosed`, since the allowlist is the gate.
- The allowlist is mandatory (at least one domain or email): an open "anyone with Google" sign-in is not asked for.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: options, tables, buckets, privacy

#### Automated
- [ ] 1.1 Option refusals and defaults tested; migration constraints and privacy export/delete tested
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: the OIDC flow and the fake provider

#### Automated
- [ ] 2.1 Flow and ID token tests (happy paths and every refusal listed) pass against the fake provider
- [ ] 2.2 Gates green (typecheck, lint, test)

### Phase 3: password switch-off and the Next adapter

#### Automated
- [ ] 3.1 Server refusals with the password off, pages, guard and form tests pass
- [ ] 3.2 Gates green (typecheck, lint, test, build)

#### Manual
- [ ] 3.3 A real Google sign-in on a deployed app (owner's adopting app, after the release)

### Phase 4: docs

#### Automated
- [ ] 4.1 README and CHANGELOG updated; markdown link test green
