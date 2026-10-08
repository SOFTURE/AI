# @softure-ai/mcp-access

Lets the users of a Next.js app connect an AI assistant (Claude Code, Claude Desktop, Cursor) to
their own data over MCP: hashed, scoped, expiring access tokens, a rate-limited Bearer endpoint
around the app's own MCP server, a token page with ready setup instructions and, opt-in, OAuth 2.1
so assistants such as claude.ai or ChatGPT connect with a consent screen instead of a pasted token.
Built from an adopting app's assistant access, with the domain server left to the app and the
limit check made race-free.

## 1. What it provides

- The table `mcp.access_tokens`: name, read or write access, expiry, last use; **only the sha256** of
  each token. A token is `sftmcp_` and 32 random bytes; the plaintext is shown once and stored nowhere.
- `POST /api/mcp`: identifies the client and counts the request (bucket `mcp`), verifies the
  `Authorization: Bearer` token, then hands the request to a **fresh server from the app's factory**
  with `{ userId, canWrite, tokenId }`. Unknown, revoked, expired and malformed tokens all get the
  same `401 invalid_token` with a `WWW-Authenticate: Bearer` challenge.
- **Writes need two consents:** the app's `allowWrites` option and a token issued with write
  access. `canWrite` is decided on every request, so turning `allowWrites` off makes every token
  read-only at once.
- A token page for the signed-in user: the app's tool catalog, an issue form, the new token with its
  setup (a prompt for Claude Code and a `claude-cli://` link, the `claude mcp add` command, an
  `mcpServers` file, Claude Desktop through `mcp-remote`, the header), and the user's tokens with
  their status (active, expiring in n days, expired), last use and a revoke button.
- **OAuth 2.1** (`oauth.enabled`, off by default), as the MCP authorization spec asks for it:
  - a `401` from the endpoint names the protected resource metadata (`resource_metadata` in the
    challenge, RFC 9728), which points at the authorization server metadata (RFC 8414);
  - dynamic client registration (RFC 7591, `POST /api/oauth/register`), public or confidential;
  - `/oauth/authorize`: authorization code with PKCE `S256` only, on a consent page that shows the
    app, where the code goes, the signed-in account and the access; writes need the `mcp:write`
    scope, `allowWrites` and the person's tick;
  - `POST /api/oauth/token`: `authorization_code` and `refresh_token`. Refresh tokens rotate on
    every use; presenting a rotated one again (`previous_refresh_token_hash`) revokes the whole
    grant, and so does reusing a code (RFC 6749 §4.1.2). `resource` (RFC 8707) must name the
    endpoint when sent; the redirect carries `iss` (RFC 9207);
  - one grant per account and client, listed on the token page as "connected apps"; revoking it
    deletes its access tokens at once (`grant_id`, `ON DELETE CASCADE`). OAuth access tokens do not
    count against `maxTokensPerUser` and are not listed with the hand-issued ones.
- Tokens an app issued before adopting the module keep working through `legacyTokenPattern`.
- Server functions for scripts and other hosts, and a health check for `GET /api/health`.

## 2. Installation

```bash
npm install @softure-ai/mcp-access @softure-ai/auth @softure-ai/security @softure-ai/core @softure-ai/db @softure-ai/ui @modelcontextprotocol/server drizzle-orm zod
```

Peer dependencies: `@modelcontextprotocol/server` `^2.0.0` (the app's factory and the endpoint
must use one copy of the SDK), `next` 16, `react` 19, `drizzle-orm`. The module depends on `auth`
and `security`; a configuration without them fails at startup.

## 3. Configuration

```ts
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { MCP_RATE_LIMIT_BUCKETS, mcpAccess } from "@softure-ai/mcp-access";
import { cloudflareIp, security } from "@softure-ai/security";
import { en } from "./messages/en";
import { pl } from "./messages/pl";

// in defineSoftureConfig({ modules: [...] }):
security({ clientIp: cloudflareIp(), buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...MCP_RATE_LIMIT_BUCKETS } }),
auth({ ... }),
mcpAccess({
  serverName: "acme",
  allowWrites: true,
  tools: [
    { name: "list_orders", access: "read", description: { en: en.mcp.listOrders, pl: pl.mcp.listOrders } },
    { name: "cancel_order", access: "write", description: { en: en.mcp.cancelOrder, pl: pl.mcp.cancelOrder } },
  ],
}),
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `serverName` | `string` | required | The name clients list the server under (lowercase, digits, inner dashes; no quotes needed in a shell). |
| `tools` | `{ name, access: "read" \| "write", description: { en, pl? } }[]` | `[]` | The catalog the token page shows. Keep it next to the factory; the example app tests that both list the same tools. |
| `allowWrites` | `boolean` | `false` | Lets write tokens be issued and used. Off, the page offers no write tokens and every token reads only. |
| `tokenLifetimeDays` | `integer` 1–365 | `90` | How long a hand-issued token works. There is no renewal: the user issues a new one. |
| `maxTokensPerUser` | `integer` 1–100 | `20` | Unexpired tokens one account may hold. Counted under a per-user lock, so parallel requests cannot overshoot. |
| `expiryWarningDays` | `integer` 0–60 | `14` | From how many calendar days before the expiry the list warns. |
| `legacyTokenPattern` | `RegExp` | — | Also accept tokens of this shape, issued by the app before it adopted the module (e.g. `/^[0-9a-f]{64}$/`), looked up by the same sha256. Must be anchored (`^…$`), without the `g` or `y` flag; tokens longer than 512 characters are refused before it runs. New tokens are always `sftmcp_`. |
| `oauth.enabled` | `boolean` | `false` | Turns on the OAuth routes, the consent page, the connected apps list and `resource_metadata`. Off, the OAuth routes answer `404`. |
| `oauth.accessTokenLifetimeMinutes` | `integer` 5–1440 | `60` | Lifetime of an access token issued through OAuth; the client refreshes it. |
| `oauth.refreshTokenLifetimeDays` | `integer` 1–365 | `90` | Lifetime of a refresh token, renewed on every rotation. An unused connection ends after it. |
| `oauth.authorizationCodeLifetimeMinutes` | `integer` 1–10 | `10` | Lifetime of an authorization code (single use). |
| `routes` | `{ page?, endpoint?, oauthConsent?, oauthDecision?, oauthToken?, oauthRegister? }` | `/account/mcp`, `/api/mcp`, `/oauth/authorize`, `/api/oauth/authorize`, `/api/oauth/token`, `/api/oauth/register` | Move the page, the endpoint or the OAuth paths; URLs in the setup and the metadata are `appOrigin` + the path. |
| `messages` | partial `en` / `pl` | — | Copy overrides. |

`allowWrites` is a deploy decision, so read it from the environment rather than hard-coding it:
`allowWrites: process.env.MCP_ALLOW_WRITES === "1"` is the intended way. Any other value, or none,
keeps every token read-only.

`MCP_RATE_LIMIT_BUCKETS` is `{ mcp: { limit: 200, windowMinutes: 15 }, "mcp-oauth": { limit: 60, windowMinutes: 15 } }`
per client address. Every endpoint request counts, valid or not, and before the token lookup;
assistants behind one address share it. `mcp-oauth` counts the public OAuth requests:
registrations per address, token requests per address and client.

## 4. Mounting

```ts
// app/api/mcp/route.ts
import { createMcpRoute } from "@softure-ai/mcp-access/next";
import { createServer } from "../../../lib/mcp-server";

export const POST = createMcpRoute({ createServer });
```

```ts
// app/account/mcp/page.tsx
export { McpAccessPage as default } from "@softure-ai/mcp-access/next";
export const dynamic = "force-dynamic";
```

The factory is the app's own MCP server, built per request:

```ts
// lib/mcp-server.ts
import { McpServer } from "@modelcontextprotocol/server";
import type { McpServerIdentity } from "@softure-ai/mcp-access";

export function createServer({ userId, canWrite }: McpServerIdentity): McpServer {
  const server = new McpServer({ name: "acme", version: "1.0.0" });
  server.registerTool("list_orders", { description: "Lists your orders." }, () => listOrders(userId));
  if (canWrite) server.registerTool("cancel_order", { ... }, (input) => cancelOrder(userId, input));
  return server;
}
```

Every query of the server must be scoped to `userId`; register write tools only when `canWrite`
is true. GET and DELETE are not exported, so Next answers them with 405: the endpoint is stateless.
Answers to 2025-era clients come as one SSE `message` event, to 2026-07-28 clients as plain JSON;
mid-call notifications (progress, logging) are dropped. Keep `/api/mcp` out of a proxy guard that
redirects to the login page: the endpoint authenticates by token, not by cookie.

`TokenManager` (`@softure-ai/mcp-access/ui`) takes the actions `issueTokenAction` and
`revokeTokenAction` (`/next`) as props for an app that composes its own page, and `grants` with
`revokeGrantAction` for the connected apps list.

With `oauth.enabled`, mount the OAuth routes and the consent page too (the paths for the default
`routes`):

```ts
// app/oauth/authorize/page.tsx
export { OAuthConsentPage as default } from "@softure-ai/mcp-access/next";
export const dynamic = "force-dynamic";

// app/api/oauth/authorize/route.ts
export { decideOAuthAuthorizationRoute as POST } from "@softure-ai/mcp-access/next";

// app/api/oauth/token/route.ts and app/api/oauth/register/route.ts
export { exchangeOAuthTokenRoute as POST, answerOAuthPreflight as OPTIONS } from "@softure-ai/mcp-access/next";
export { registerOAuthClientRoute as POST, answerOAuthPreflight as OPTIONS } from "@softure-ai/mcp-access/next";

// app/.well-known/oauth-authorization-server/route.ts
export { getAuthorizationServerMetadataRoute as GET, answerOAuthPreflight as OPTIONS } from "@softure-ai/mcp-access/next";

// app/.well-known/oauth-protected-resource/route.ts and
// app/.well-known/oauth-protected-resource/api/mcp/route.ts (the endpoint's path after the prefix)
export { getProtectedResourceMetadataRoute as GET, answerOAuthPreflight as OPTIONS } from "@softure-ai/mcp-access/next";
```

`/.well-known/oauth-*`, `/api/oauth/token` and `/api/oauth/register` are public: keep them out of
a proxy guard, like `/api/mcp`. The consent page and the decision route check the session
themselves (the page sends a signed-out person to the login page and back); the decision route
also refuses a request whose `Origin` is not `appOrigin`.
TypeScript's `**` skips dot folders: with an `include` list in `tsconfig.json`, add
`"app/.well-known/**/*.ts"`.

## 5. Migrations and tables

`migrations/0001_create_access_tokens.sql` creates `mcp.access_tokens`:

| Column | Meaning |
| --- | --- |
| `id uuid` | The token's id: what the list and the revoke action name, and what logs may carry. |
| `user_id uuid` | The owner, `REFERENCES auth.users ON DELETE CASCADE`: deleting an account deletes its tokens. |
| `name text` | 1–60 characters, trimmed. |
| `token_hash text` | sha256 hex, unique. |
| `can_write boolean` | Issued with write access (still needs `allowWrites`). |
| `created_at`, `expires_at` | `expires_at > created_at`; a token works while `expires_at > now`. |
| `last_used_at` | Written on verification at most once a minute; informational only. |

Issuing deletes the issuer's expired tokens; `pruneAccessTokens(ctx)` (`/server`) deletes every
expired token, for a scheduled job. Rollback: in the migration header.

`migrations/0002_create_oauth_grants.sql` creates `mcp.oauth_clients` (client id, name, redirect
URIs, auth method, sha256 of a confidential client's secret), `mcp.oauth_authorization_codes`
(sha256, PKCE challenge, redirect URI, single use through `used_at`) and `mcp.oauth_grants` (one
per account and client: write flag, sha256 of the current and the previous refresh token, refresh
expiry, last use), and adds `access_tokens.grant_id` (null for hand-issued tokens). Every row goes
with the account. `pruneOAuthRecords(ctx)` deletes expired codes, grants whose refresh token has
expired (with their access tokens) and clients registered over a day ago that hold no grant.

### Adopting an app's own tables

An app that ran its own `public.access_tokens` (with `grant_id`) and `oauth_clients`,
`oauth_authorization_codes` and `oauth_grants` tables, with the module's column names, adopts them
without losing a row. `adoption/move-app-tables.sql` (shipped in the package, tested in
`tests/adoption.test.ts`) moves the four tables into `mcp`, drops the app's constraints, indexes
and defaults whatever their names, cuts names to 60 characters, drops authorization codes the
module cannot verify, and creates the module's constraints and indexes. Run it as the app's own
migration in `before`, then declare the baseline ([adoption playbook](../../docs/05-adoption-playbook.md) step 3):

```ts
app: { before, baseline: { "mcp-access": 2 } }
```

Old tokens keep working with `legacyTokenPattern`; connected apps keep their grants, and their old
refresh tokens rotate into module-shaped ones on the next refresh. An app without OAuth tables
drops its `grant_id` column (if any), deletes the OAuth part of the script and uses
`baseline: { "mcp-access": 1 }`; file 2 then runs as a normal migration.

## 6. Environment variables

None of its own. The endpoint URL comes from `appOrigin` in `softure.config.ts`.

## 7. Switches

None. `allowWrites` is configuration, not a runtime switch: changing who may write is a deploy.

## 8. Appearance

`TokenManager` slots: `root`, `section`, `heading`, `text`, `list`, `item`, `itemHeader`, `badge`,
`details`, `snippet`, `code`; `unstyled` renders structure only. Styling comes from
`@softure-ai/ui` classes on the `--sft-*` tokens; the module ships no CSS of its own.

## 9. Copy

`mcpAccessMessages.{en,pl}`: `page`, `tools`, `issue`, `issued`, `setup.assistantPrompt`
(placeholders `{serverName}` and `{command}`), `list`, `grants` (connected apps), `consent` (the
consent page and its errors), and `errors` for the codes
`mcp-access.name_required`, `name_too_long`, `token_limit_reached`, `token_not_found`, `grant_not_found`,
`auth.unauthenticated`, `core.database_failed` and `core.unexpected`. Tool descriptions come from
the `tools` option, per locale.

## 10. Hooks

The MCP server factory passed to `createMcpRoute` is the module's only hook. `/server` also exports
`createMcpEndpoint({ createServer })`, a `(ctx, request) => Response` for hosts other than Next, and
`issueAccessToken`, `listAccessTokens`, `revokeAccessToken`, `verifyAccessToken` and
`pruneAccessTokens` for scripts. For OAuth: `listOAuthGrants`, `revokeOAuthGrant`,
`pruneOAuthRecords`, the protocol steps (`registerMcpClient`, `createAuthorizationCode`,
`exchangeAuthorizationCode`, `refreshMcpGrant`) and the HTTP handlers behind the routes
(`handleClientRegistration`, `handleTokenRequest`, `handleAuthorizationDecision`,
`validateAuthorizationRequest`, `serveDiscoveryDocument`) for hosts other than Next.

## 11. GDPR

The rows hold no personal data beyond the owner's id and the token names. The module contributes
to `@softure-ai/privacy` (`privacy` flags on):

- **Export** (`exportMcpAccessUserData`): `accessTokens`, each hand-issued token's name, write
  flag and created, expiry and last-use dates, and `connectedApps`, each grant's client name, write
  flag, created and last-use dates. Never a hash.
- **Deletion** (`deleteMcpAccessUserData`): the user's authorization codes, grants and tokens,
  before auth deletes the account (the foreign keys' cascade would remove them too). Registered
  clients hold no personal data and are pruned when unused.

## 12. Limitations / known gaps

- OAuth has no token introspection or revocation endpoint (RFC 7009) for clients: the person
  disconnects an app on the token page. Access tokens are opaque; there is no `jwks_uri`.
- Only `S256` PKCE and the `authorization_code` and `refresh_token` grants.
- Write access is per token, not per tool; finer scopes would be a new option.
- The rate limit is per client address, not per token.
- `responseMode: "json"` drops mid-call notifications; a streaming tool would need a different mode.
