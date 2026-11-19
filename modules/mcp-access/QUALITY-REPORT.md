# Security report

<!-- softure-quality-review format 1 -->

A read-only security review of `modules/mcp-access` (@softure-ai/mcp-access) at one commit (`@softure-ai/quality-review`). Each run replaces this
file; the format is documented in the package README, "Report format".

| Field | Value |
| --- | --- |
| Date | 2026-11-19T10:21:20Z |
| Commit | `756194deec491a4584fc22e4c3feb08602898e66` |
| Focus | security |
| Scope | `modules/mcp-access` (@softure-ai/mcp-access) |
| Model | claude-opus-5-5 |
| Cost | 1.1881 USD of a 15.00 USD budget |
| Tokens | input 38, output 8678, cache read 1648710, cache write 136934 |
| Turns | 39 |
| Files read | 31 |
| Status | complete |
| Findings | 0 critical, 0 warning, 0 suggestion |
| Ignored | 0 |

No findings: the review found nothing to report at this commit.

## Coverage

| Scenario | Status | Files | Note |
| --- | --- | --- | --- |
| auth-session | traced | `modules/mcp-access/src/server/tokens.ts`, `modules/mcp-access/src/server/oauth.ts`, `modules/mcp-access/src/next/actions.ts`, `modules/mcp-access/src/next/issue-token.ts`, `modules/mcp-access/src/next/oauth-page.tsx` | The module has no sign-in, cookies or password reset of its own; the session comes from @softure-ai/auth (getCurrentUser/requireUser). Traced how a password change ends tokens: findValidToken, listAccessTokens, exchangeAuthorizationCode and refreshMcpGrant all filter on users.password_changed_at (NOT NULL in auth's schema), so a token, grant or code issued before a reset no longer works. |
| oauth-flow | traced | `modules/mcp-access/src/server/oauth-http.ts`, `modules/mcp-access/src/server/oauth.ts`, `modules/mcp-access/src/server/pkce.ts`, `modules/mcp-access/src/server/oauth-validation.ts`, `modules/mcp-access/src/server/origins.ts`, `modules/mcp-access/src/origins.ts`, `modules/mcp-access/src/next/oauth-routes.ts`, `modules/mcp-access/src/next/oauth-page.tsx`, `modules/mcp-access/src/server/registration-window.ts`, `modules/mcp-access/src/scripts/registration-scripts.ts` | Traced registration, the consent page, the consent decision and the token endpoint. Redirect URIs must match the registered list exactly (includes), and an error is shown, not redirected, before the client is confirmed. PKCE accepts only S256 and compares in constant time. Codes are burned by a conditional UPDATE, and reusing one revokes its grant. Refresh tokens rotate, and replaying the previous one deletes the grant. resource is checked on both sides. The decision checks Origin/Host and is rate-limited per account. Registration is rate-limited, capped in size and its abandoned clients are pruned. No outbound fetch of client metadata. |
| token-scope | traced | `modules/mcp-access/src/server/endpoint.ts`, `modules/mcp-access/src/server/tokens.ts`, `modules/mcp-access/src/server/api-tokens.ts`, `modules/mcp-access/src/server/writes-switch.ts`, `modules/mcp-access/src/jobs/operations.ts`, `modules/mcp-access/src/jobs/operation-state.ts`, `modules/mcp-access/src/jobs/operation-tasks.ts`, `modules/mcp-access/src/server/confirmation.ts`, `modules/mcp-access/src/server/action-tool.ts`, `modules/mcp-access/src/server/tools.ts`, `modules/mcp-access/src/stdio/serve.ts`, `modules/mcp-access/src/server/privacy.ts` | Write access is decided on every request: the token's can_write AND allowWrites AND the writes switch, which fails closed. Lookups are separated by kind, so an MCP token never passes requireApiToken and an API token never opens the MCP endpoint. API scopes are checked against the declared list. Revoking a token or grant puts the owner in the WHERE. Operations and tasks are scoped by the mcp:<uuid>: dedup prefix and the task owner; cancelling needs canWrite. Confirmations are HMACs bound to the caller, the tool and the arguments, and work once. |
| webhook-verification | no surface | - | No webhook receiver in modules/mcp-access/src: the only routes are the MCP endpoint, OAuth discovery/register/token/decision and the consent page (read via next/oauth-routes.ts and next/route.ts). |
| command-injection | traced | `modules/mcp-access/src/cli/run.ts`, `modules/mcp-access/src/client-setup.ts`, `modules/mcp-access/src/stdio/serve.ts` | No child_process/exec/spawn/ssh anywhere in src (Grep). The softure-mcp CLI accepts only 'prune', with no further arguments. The claude mcp add snippet is built from a validated serverName, the app's own origin and a token of a fixed shape, and is shown to its owner, never run. |
| ssrf | no surface | - | Grep for fetch( in modules/mcp-access/src finds only the SDK's in-process handler.fetch; registered redirect URIs and client metadata are stored and redirected to, never fetched. |
| csrf | traced | `modules/mcp-access/src/server/oauth-http.ts`, `modules/mcp-access/src/next/actions.ts`, `modules/mcp-access/src/next/oauth-routes.ts` | The cookie-backed consent decision POST requires an Origin that is the app origin or matches Host, on top of SameSite=Lax. The token page's issue and revoke actions are Next server actions, which get Next's Origin check. The registration and token routes read no cookie (CORS * is safe there), and GET routes only serve discovery documents. |
| rate-limit | traced | `modules/mcp-access/src/server/endpoint.ts`, `modules/mcp-access/src/server/oauth-http.ts`, `modules/mcp-access/src/server/api-tokens.ts` | The MCP endpoint counts per verified token, and per client address (identifyClient from security) for a request without a valid token. Registration counts per address. The token endpoint counts per address plus a registered client (per address alone for an unknown client or an oversized body). Consent decisions count per account. API routes count per address before the lookup and per token after. Every counter fails closed with 503. |
| secrets | traced | `modules/mcp-access/src/server/tokens.ts`, `modules/mcp-access/src/server/request-diagnostics.ts`, `modules/mcp-access/src/server/tools.ts`, `modules/mcp-access/src/cli/run.ts`, `modules/mcp-access/src/server/confirmation.ts`, `modules/mcp-access/src/server/api-tokens.ts` | Tokens, codes, refresh tokens and client secrets are stored only as sha256. Logs carry errorLogLabel and token ids, never plaintext. Diagnostics keep only sanitized method, tool and clientInfo. Tool errors expose only safeError codes. The only key-like strings in the module are 'sk_live' placeholders in error messages in tests, and it has no env files. |
| runtime-hardening | no surface | - | The package ships no Dockerfile, compose file, env file or workflow (Glob over modules/mcp-access for Dockerfile*, *compose*.yml, *.yaml, .env*); deployment belongs to the adopting app and the repository's deploy tooling. |

## Critical

None.

## Warnings

None.

## Suggestions

None.
