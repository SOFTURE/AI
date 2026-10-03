# @softure-ai/mcp-access

Lets the users of a Next.js app connect an AI assistant (Claude Code, Claude Desktop, Cursor) to
their own data over MCP: hashed, scoped, expiring access tokens, a rate-limited Bearer endpoint
around the app's own MCP server, and a token page with ready setup instructions. Built from
FIRE_TRACKER's assistant access (`src/db/access-tokens.ts`, `src/lib/{mcp-auth,access-token-status,mcp-client-config}.ts`,
`src/app/api/mcp/route.ts`, `src/app/actions/{manage-tokens,tokens,tokens-contract}.ts`), with the
domain server left to the app and the limit check made race-free.

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
- Server functions for scripts and other hosts, and a health check for `GET /api/health`.

OAuth for MCP (discovery, dynamic client registration) is not part of this module: clients that
send a static header cover the personal-token case.

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
| `tokenLifetimeDays` | `integer` 1–365 | `90` | How long a token works. There is no renewal: the user issues a new one. |
| `maxTokensPerUser` | `integer` 1–100 | `20` | Unexpired tokens one account may hold. Counted under a per-user lock, so parallel requests cannot overshoot. |
| `expiryWarningDays` | `integer` 0–60 | `14` | From how many calendar days before the expiry the list warns. |
| `routes` | `{ page?, endpoint? }` | `/account/mcp`, `/api/mcp` | Move the page or the endpoint; the endpoint URL in the setup is `appOrigin` + `endpoint`. |
| `messages` | partial `en` / `pl` | — | Copy overrides. |

`MCP_RATE_LIMIT_BUCKETS` is `{ mcp: { limit: 200, windowMinutes: 15 } }` per client address. Every
request counts, valid or not, and before the token lookup; assistants behind one address share it.

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
`revokeTokenAction` (`/next`) as props for an app that composes its own page.

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
(placeholders `{serverName}` and `{command}`), `list`, and `errors` for the codes
`mcp-access.name_required`, `name_too_long`, `token_limit_reached`, `token_not_found`,
`auth.unauthenticated`, `core.database_failed` and `core.unexpected`. Tool descriptions come from
the `tools` option, per locale.

## 10. Hooks

The MCP server factory passed to `createMcpRoute` is the module's only hook. `/server` also exports
`createMcpEndpoint({ createServer })`, a `(ctx, request) => Response` for hosts other than Next, and
`issueAccessToken`, `listAccessTokens`, `revokeAccessToken`, `verifyAccessToken` and
`pruneAccessTokens` for scripts.

## 11. GDPR

Exports nothing and registers no delete contributor yet (`privacy` arrives in EN-7). The rows hold
no personal data beyond the owner's id and the token names; deleting the account deletes them
through the foreign key.

## 12. Limitations / known gaps

- No OAuth for MCP: clients without a header field use `mcp-remote` (Claude Desktop) or another
  bridge.
- Write access is per token, not per tool; finer scopes would be a new option.
- The rate limit is per client address, not per token.
- `responseMode: "json"` drops mid-call notifications; a streaming tool would need a different mode.
