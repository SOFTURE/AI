# Research: auth-oidc-sign-in-769

Input: change.md, issue #769, `modules/auth/**`, `modules/connections/src/server/{flow,token-client}.ts`,
`modules/connections/src/testing/fake-provider.ts`, `foundation/core/src/http-json.ts`.

## What exists

- **auth** signs in only with email and password. `users.password_hash` is `NOT NULL CHECK (LIKE 'scrypt$%')`
  (`migrations/0001`); login, change password and reset read it. Sessions are database rows keyed by the sha256 of a
  cookie token (`server/sessions.ts`, `createSession`), and `requireUser`, `requireRole`, `adminEmails` read only the
  session and the email, so a session opened by any sign-in path works for every module.
- `assertAuthBuckets` checks the app's `security({ buckets })` once per config; reset buckets are required only when
  reset is on. The same pattern fits OIDC buckets.
- The proxy guard (`proxy/index.ts`) lists auth's own public pages; an OIDC callback under a protected `/` would be
  sent to the login page, so its prefix must join that list.
- `LoginPage` renders `LoginForm` (client, `useActionState`); `notice` is the only extra slot. The architecture test
  forbids inline copy and classes ui does not compile (`sft:text-center`, `sft:h-px`, `sft:bg-border`, `sft:flex-1`
  exist).
- **connections** runs the authorization code flow with PKCE (state hashed in a table, verifier sealed, bound to the
  admin's user id) and posts token requests through core's `requestJson` with `errorSchema` (core ^0.2.4, form bodies
  since 0.2.4). connections depends on auth, so auth cannot import it.
- **core** `requestJson`: timeout, no redirect followed, failures as codes; `form` bodies from 0.2.4. auth today needs
  core `^0.2.0`; using `form` and `errorSchema` raises that to `^0.2.4` (already on npm).
- Node 22 `crypto.createPublicKey({ key: jwk, format: "jwk" })` and `crypto.verify` verify RS256 and ES256
  (`dsaEncoding: "ieee-p1363"` for the JWS form), so no JOSE dependency is needed.

## Facts about the providers

- OIDC Discovery: `<issuer>/.well-known/openid-configuration` gives `issuer`, `authorization_endpoint`,
  `token_endpoint`, `jwks_uri`; the `issuer` in it must equal the configured one (OIDC Discovery §4.3).
- Google signs ID tokens with RS256, rotates keys (several in the JWKS, `kid` in the header), sends `email`,
  `email_verified` (boolean) and `hd` for Workspace accounts only. A consumer Google account can carry a verified
  non-Gmail address, so a domain check by the email alone is not enough for Google: Google's guidance is to check `hd`.
- ID token checks (OIDC Core §3.1.3.7): `iss`, `aud` contains the client id, `azp` equals it when there are several
  audiences, `exp` in the future, `nonce` equals the one sent. Allowed algorithms are pinned (no `none`, no HMAC).
- The callback is a top-level cross-site GET from the provider, so a `SameSite=Lax` cookie set at the start is sent
  back; binding the state to such a cookie stops a login CSRF (an attacker's callback URL opened in the victim's
  browser would sign the victim in as the attacker).

## Options considered

- **State storage**: a table row (state hash, nonce, verifier, next, expiry) consumed with `DELETE … RETURNING`, plus
  a short-lived cookie holding the state so the callback must come back to the browser that started it. Chosen: a
  server-side one-time guarantee and browser binding, no signing key needed. Cookie-only state was rejected: it needs
  a key to sign the `next` path and gives no server-side single use.
- **Accounts without a password**: making `password_hash` nullable touches every password path and its CHECK; storing
  an unusable scrypt hash of 32 random bytes keeps the schema and every password path as they are. Chosen: the
  unusable hash.
- **Linking**: a first sign-in with a verified, allowed email links the account with that email; a user who already
  has an identity of that provider with another subject is refused (`UNIQUE (user_id, provider)`), so a recycled
  Workspace address cannot take over an account.

## Unknowns resolved

- Route handler signature in Next 16: `(request, { params: Promise<{ provider: string }> })`, as agent-ready's
  `serveAgentSkill`. `cookies()` works in a route handler and its writes go out with the returned `Response`.
- `RegisteredEvent` can grow an `oidcProvider` field (additive) so an `onRegistered` hook tells the two paths apart;
  `consent` is `null` there, as already typed.
