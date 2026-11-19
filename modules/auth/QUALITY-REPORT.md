# Security report

<!-- softure-quality-review format 1 -->

A read-only security review of `modules/auth` (@softure-ai/auth) at one commit (`@softure-ai/quality-review`). Each run replaces this
file; the format is documented in the package README, "Report format".

| Field | Value |
| --- | --- |
| Date | 2026-11-19T09:34:55Z |
| Commit | `3975caeb0249e1fa568eb8fae1148fec7da8225a` |
| Focus | security |
| Scope | `modules/auth` (@softure-ai/auth) |
| Model | claude-opus-5-5 |
| Cost | 1.0068 USD of a 15.00 USD budget |
| Tokens | input 42, output 9464, cache read 1534240, cache write 102095 |
| Turns | 46 |
| Files read | 38 |
| Status | complete |
| Findings | 0 critical, 0 warning, 0 suggestion |
| Ignored | 1 |

No findings: the review found nothing to report at this commit.

## Coverage

| Scenario | Status | Files | Note |
| --- | --- | --- | --- |
| auth-session | traced | `modules/auth/src/server/sessions.ts`, `modules/auth/src/server/login.ts`, `modules/auth/src/server/session-token.ts`, `modules/auth/src/next/actions.ts`, `modules/auth/src/server/password-reset.ts`, `modules/auth/src/server/change-password.ts`, `modules/auth/src/next/session-cookie.ts`, `modules/auth/src/next/previous-session.ts`, `modules/auth/src/session-cookie.ts`, `modules/auth/src/server/register.ts`, `modules/auth/src/server/password.ts`, `modules/auth/src/server/reauthenticate.ts`, `modules/auth/src/scripts/temporary-password.ts`, `modules/auth/src/next/current-user.ts` | Login, registration and sign-in through a provider end the browser's earlier sessions and write a new random 32-byte token, stored as sha256. The cookie is HttpOnly, SameSite=Lax, Secure with the __Host-/__Secure- prefix, and its Max-Age is bounded by a fixed TTL. Reset tokens are 32 bytes, stored hashed, work once through a conditional delete in a transaction and expire. A reset request never looks the account up. Password change and reset end the other sessions. The one gap found is email enumeration through registration. |
| oauth-flow | traced | `modules/auth/src/server/oidc/flow.ts`, `modules/auth/src/next/oidc-route.ts`, `modules/auth/src/next/oidc-cookie.ts`, `modules/auth/src/server/oidc/accounts.ts`, `modules/auth/src/server/oidc/id-token.ts`, `modules/auth/src/server/oidc/allowlist.ts`, `modules/auth/src/server/oidc/discovery.ts`, `modules/auth/src/server/oidc/github.ts`, `modules/auth/src/server/oidc/context.ts`, `modules/auth/src/server/oidc/token-request.ts`, `modules/auth/src/safe-next-path.ts`, `modules/auth/src/redirect-target.ts` | The package is an OIDC/GitHub client, not an authorization server. The redirect_uri is fixed on appOrigin. PKCE S256 and the nonce are used, and the state is stored hashed, deleted on use and tied to the browser by a host-only cookie compared in constant time. The ID token must be RS256 or ES256 signed by a JWKS key, and its iss, aud, azp, exp and nonce are checked. Discovery endpoints must be https, and requests follow no redirect. Linking an account that no provider has verified yet revokes its password, sessions and reset link. Every `next` path goes through toSafeNextPath. |
| token-scope | traced | `modules/auth/src/next/current-user.ts`, `modules/auth/src/server/roles.ts`, `modules/auth/src/next/route.ts`, `modules/auth/src/server/privacy.ts`, `modules/auth/src/proxy/index.ts` | There are no API tokens and no MCP tools. Role checks (requireRole and authorizeRole) read the user from the session cookie, refuse when the user is missing, and throw for a role the app never declared. Actions take the user from the cookie, never from client arguments. The proxy guard only checks that the cookie exists and relies on requireUser behind it, as documented. |
| webhook-verification | no surface | - | No webhook receiver in modules/auth/src. The only inbound route from a third party is the OIDC callback, which is covered under oauth-flow; the routes are next/route.ts and next/oidc-route.ts. |
| command-injection | traced | `modules/auth/src/scripts/role-scripts.ts`, `modules/auth/src/scripts/seed-account.ts`, `modules/auth/src/scripts/temporary-password.ts` | No child_process, spawn or exec anywhere in modules/auth/src (Grep). The operator scripts parse their arguments with strict zod schemas into parameterised drizzle queries, declare the password hash as a secret, and never print the email or hash. |
| ssrf | traced | `modules/auth/src/server/oidc/discovery.ts`, `modules/auth/src/server/oidc/token-request.ts`, `modules/auth/src/server/oidc/github.ts` | Outbound requests go only to the configured issuer (https required in options.ts), the https endpoints its discovery document names (the document's issuer must match), and GitHub's fixed URLs. All go through requestJson with a timeout and no redirect. No URL comes from user input. |
| csrf | traced | `modules/auth/src/next/actions.ts`, `modules/auth/src/next/route.ts`, `modules/auth/src/next/oidc-cookie.ts` | Every state change is a Next server action, which checks Origin against Host, and the session cookie is SameSite=Lax. The only GET handlers are the read-only session route and the OIDC callback, which needs the browser's state cookie. |
| rate-limit | traced | `modules/auth/src/server/rate-limits.ts`, `modules/auth/src/server/login.ts`, `modules/auth/src/server/register.ts`, `modules/auth/src/server/password-reset.ts`, `modules/auth/src/server/change-password.ts`, `modules/auth/src/server/oidc/flow.ts` | Login counts per address and per email before hashing. Registration, reset requests (per address and per email), reset confirmation, password change (per user), OIDC start and OIDC callback each count their own bucket. assertAuthBuckets refuses to run when a bucket is missing. The client key comes from security's identifyClient, which the app configures. |
| secrets | traced | `modules/auth/src/password-reset-sender.ts`, `modules/auth/src/next/actions.ts`, `modules/auth/src/server/oidc/flow.ts`, `modules/auth/src/server/oidc/context.ts`, `modules/auth/src/mailing/reset-mail.ts`, `modules/auth/src/jobs/password-reset-job.ts`, `modules/auth/src/scripts/seed-account.ts` | Logs carry only errorLogLabel, the module's own reason wording, or lengths. The console reset sender refuses to run under NODE_ENV=production. OIDC client secrets are read from the environment and only their variable names appear in errors. A Grep for private keys and live secrets in modules/auth found nothing. |
| runtime-hardening | no surface | - | modules/auth has no Dockerfile, compose file, CI workflow or host config; Glob of the module root lists only package.json, module.json, tsconfig files and docs. |

## Critical

None.

## Warnings

None.

## Suggestions

None.
