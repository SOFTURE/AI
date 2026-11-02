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
  same `401 invalid_token` with a `WWW-Authenticate: Bearer` challenge. The challenge's `scope` is
  `mcp:read mcp:write` while the app allows writes and `mcp:read` otherwise, so an OAuth client asks
  for what it may get.
- **Writes need the app and the token:** the app's `allowWrites` option, the runtime switch
  `mcp-access.writes_enabled` when the app defines it (§7), and a token issued with write access.
  `canWrite` is decided on every request, so turning `allowWrites` or the switch off makes every token
  read-only at once.
- A token page for the signed-in user: the app's tool catalog, an issue form, the new token with its
  setup (a prompt for Claude Code and a `claude-cli://` link, the `claude mcp add` command, an
  `mcpServers` file, Claude Desktop through `mcp-remote`, the header), and the user's tokens with
  their status (active, expiring in n days, expired), last use and a revoke button.
- **OAuth 2.1** (`oauth.enabled`, off by default), as the MCP authorization spec asks for it:
  - a `401` from the endpoint names the protected resource metadata (`resource_metadata` in the
    challenge, RFC 9728), which points at the authorization server metadata (RFC 8414);
  - dynamic client registration (RFC 7591, `POST /api/oauth/register`), public or confidential;
    open to anyone, or closed outside a window an ops script opens (`oauth.registration`);
  - `/oauth/authorize`: authorization code with PKCE `S256` only, on a consent page that shows the
    app's self-declared name, where the code goes (a row of its own, in monospace: the one part a
    client cannot fake), the signed-in account and the access; writes need the `mcp:write` scope, the
    app allowing writes (`allowWrites` and the switch) and the person's tick. A request without `scope`
    gets the default scope: both scopes while the app allows writes, `mcp:read` otherwise;
  - `POST /api/oauth/token`: `authorization_code` and `refresh_token`. Refresh tokens rotate on
    every use; presenting a rotated one again (`previous_refresh_token_hash`) revokes the whole
    grant, and so does reusing a code (RFC 6749 §4.1.2). `resource` (RFC 8707) must name the
    endpoint when sent; the redirect carries `iss` (RFC 9207);
  - one grant per account and client, listed on the token page as "connected apps"; revoking it
    deletes its access tokens at once (`grant_id`, `ON DELETE CASCADE`). OAuth access tokens do not
    count against `maxTokensPerUser` and are not listed with the hand-issued ones.
- **Tokens for the app's own HTTP routes** (`apiTokens`, off by default): personal tokens with the app's prefix and
  scopes (`recipes:write`) for a phone Shortcut, an automation tool or a script, checked in a route handler with
  `requireApiToken` from `@softure-ai/mcp-access/tokens`, an entry that loads no MCP SDK (§4 "Tokens for HTTP routes").
- Tokens an app issued before adopting the module keep working through `legacyTokenPattern`.
- Server functions for scripts and other hosts, and a health check for `GET /api/health`.
- For the app's own server: tool result helpers with a safe error boundary and server actions as write tools
  (`/server`), a server factory whose version follows the tool list, so clients drop a stale cached `tools/list`
  (`createMcpServerFactory`, `measureToolList`, `/server`), strict tool input that refuses unknown and renamed
  fields (`withStrictToolInput`, `/server`), an opt-in `get_server_info` tool that tells which build answers
  (`serverInfoTool`, `/server`), a stdio entry for local assistants (`/stdio`), a catalog parity check (`/testing`), a gate before a
  token is issued (`issueToken`, `/next`), long operations as tools over `@softure-ai/jobs` (`startOperation`,
  `get_operation`, `cancel_operation`, `/jobs`) and the `softure-mcp prune` command for a daily cleanup (§4, §5).

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
import { de } from "./messages/de"; // the app's own translation

// in defineSoftureConfig({ modules: [...] }):
security({ clientIp: cloudflareIp(), buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...MCP_RATE_LIMIT_BUCKETS } }),
auth({ ... }),
mcpAccess({
  serverName: "acme",
  allowWrites: true,
  tools: [
    { name: "list_orders", access: "read", description: { en: en.mcp.listOrders, de: de.mcp.listOrders } },
    { name: "cancel_order", access: "write", description: { en: en.mcp.cancelOrder, de: de.mcp.cancelOrder } },
  ],
}),
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `serverName` | `string` | required | The name clients list the server under (lowercase, digits, inner dashes; no quotes needed in a shell). |
| `clientServerName` | `string` | `serverName` | The name the setup snippets register the server under (`claude mcp add`, the JSON configs, the assistant prompt), same pattern. Set it when users already added the server under another name: a new name gives everyone who reconnects a second entry. |
| `tools` | `{ name, access: "read" \| "write", description: { en, <locale>? }, title?: { en, <locale>? }, example?: { en, <locale>? } }[]` | `[]` | The catalog the token page shows. `title` (a display name) and `example` (a request a person could make) are for agent docs that read the catalog. Keep it next to the factory; `expectToolCatalogMatchesServer` (`/testing`) checks that both list the same tools. |
| `allowWrites` | `boolean` | `false` | Lets write tokens be issued and used. Off, the page offers no write tokens and every token reads only. |
| `tokenLifetimeDays` | `integer` 1–365 | `90` | How long a hand-issued token works. There is no renewal: the user issues a new one. |
| `maxTokensPerUser` | `integer` 1–100 | `20` | Unexpired tokens one account may hold. Counted under a per-user lock, so parallel requests cannot overshoot. |
| `expiryWarningDays` | `integer` 0–60 | `14` | From how many calendar days before the expiry the list warns. |
| `legacyTokenPattern` | `RegExp` | — | Also accept tokens of this shape, issued by the app before it adopted the module (e.g. `/^[0-9a-f]{64}$/`), looked up by the same sha256. Must be anchored (`^…$`), without the `g` or `y` flag; tokens longer than 512 characters are refused before it runs. New tokens are always `sftmcp_`. |
| `oauth.enabled` | `boolean` | `false` | Turns on the OAuth routes, the consent page, the connected apps list and `resource_metadata`. Off, the OAuth routes answer `404`. |
| `oauth.registration` | `"open"` \| `"closed"` | `"open"` | Dynamic client registration. `"closed"`: `POST /api/oauth/register` answers `403 access_denied` except while a window opened by the `open-client-registration` ops script lasts (§4, "Closed registration"). |
| `oauth.accessTokenLifetimeMinutes` | `integer` 5–1440 | `60` | Lifetime of an access token issued through OAuth; the client refreshes it. |
| `oauth.refreshTokenLifetimeDays` | `integer` 1–365 | `90` | Lifetime of a refresh token, renewed on every rotation. An unused connection ends after it. |
| `oauth.authorizationCodeLifetimeMinutes` | `integer` 1–10 | `10` | Lifetime of an authorization code (single use). |
| `oauth.maxBodyBytes` | `integer` 1024–1048576 | `16384` | The largest body the registration, token and consent decision routes read. Larger: `413` (`invalid_request` on registration and token), before it fills memory. Real bodies stay under 4 KiB. |
| `oauth.metadata` | `{ authorizationServer?, protectedResource? }`, each an object or `(origins) => object` | — | Extra keys of the discovery documents (`jwks_uri`, `service_documentation`, `resource_documentation`, `agent_auth`…). Generated keys win; a static object that sets one is refused at startup. The protected resource document takes the app's `resource_name` (default: `serverName`). |
| `resolveAppOrigin` | `(request) => string \| null` | — | The app origin of one request, ahead of the config's `origins` block (prefer that block: every module reads it). `readRequestOrigin` reads it from `Host`. Null falls back to the block's rule; anything but a bare http(s) origin throws. |
| `resourceOrigins` | `string[]` (≤ 16 http(s) origins) | `[]` | Other public hosts of the app, e.g. the apex next to `app.`: the root protected resource metadata asked on one of them names it as `resource`, and the OAuth endpoints accept it as `resource`. |
| `routes` | `{ page?, endpoint?, oauthConsent?, oauthDecision?, oauthToken?, oauthRegister? }` | `DEFAULT_MCP_ACCESS_ROUTES` (root entry): `/account/mcp`, `/api/mcp`, `/oauth/authorize`, `/api/oauth/authorize`, `/api/oauth/token`, `/api/oauth/register` | Move the page, the endpoint or the OAuth paths; URLs in the setup and the metadata are the app origin (`appOrigin`, or `resolveAppOrigin`'s) + the path. |
| `messages` | partial dictionaries per locale (`en` built in; any other is the app's own translation) | — | Copy overrides. |

`allowWrites` is a deploy decision, so read it from the environment rather than hard-coding it:
`allowWrites: process.env.MCP_ALLOW_WRITES === "1"` is the intended way. Any other value, or none,
keeps every token read-only.

`MCP_RATE_LIMIT_BUCKETS` is `{ mcp: { limit: 200, windowMinutes: 15 }, "mcp-oauth": { limit: 60, windowMinutes: 15 } }`
per client address. Every endpoint request counts, valid or not, and before the token lookup;
assistants behind one address share it. `mcp-oauth` counts the public OAuth requests:
registrations per address, token requests per address and client (a token request whose body
is over `oauth.maxBodyBytes` counts per address, since its client id is never read).

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

### A version that follows the tool list

MCP clients keep their cached `tools/list` until the server version they read at `initialize` changes, so a
release that adds a tool or changes a schema under the same `version` leaves the assistant on the old schemas.
`createMcpServerFactory` builds the factory with a version derived from the tools:

```ts
// lib/mcp-server.ts
import { createMcpServerFactory } from "@softure-ai/mcp-access/server";

export const createServer = createMcpServerFactory({
  name: "acme",
  release: "2.1.0", // optional, default 1.0.0
  registerTools: (server, { userId, canWrite }) => {
    server.registerTool("list_orders", { description: "Lists your orders." }, () => listOrders(userId));
    if (canWrite) server.registerTool("cancel_order", { ... }, (input) => cancelOrder(userId, input));
  },
});
```

- The version is `<release>-tools-<12 hex>`, a semver prerelease (comparisons ignore build metadata). The hex is a
  sha256 of every tool as `tools/list` serves it (name, title, description, annotations, input and output JSON
  Schema), in name order with keys sorted: the same registrations always give the same version, any change of a
  name, description or schema changes it, a different registration order does not.
- It is measured once per access level, on a recording server with the same name and `serverOptions`, so a
  read-only token gets the version of its smaller list. The list may depend on `canWrite` only; for one that depends
  on the account, call `measureToolList(registerTools, { release, name })` → `{ toolListVersion, toolCount }` per
  server instead. `version` passes a fixed value instead of the measured one.
- In the app's tests, `measureServedToolLists(createServer)` (`/testing`) gives `{ read, write }` with the version
  and count of each level, for an inline snapshot next to the catalog check: a schema change that forgets to update
  the snapshot fails the test.

### Strict tool input

zod objects strip unknown keys, so a call with a misspelt field (`notes` for `note`) or a field of a newer tool list
answers as a write that worked while the value was dropped. `withStrictToolInput(server, options?)` rewrites every
input schema registered on the server from then on, or pass `strictToolInput: true | options` to
`createMcpServerFactory` (the version is then measured on the strict listing):

```ts
const server = withStrictToolInput(new McpServer({ name: "acme", version }), {
  renamedFields: { notes: "note" }, // old name → new name, or a rule: (field) => newName | undefined
  coerceTextScalars: true, // default
  messages: getMcpAccessMessages(config).toolInput, // default: the English dictionary
});
```

- **Unknown fields** are refused at every level: nested objects, arrays, records, tuples, optionals, defaults,
  unions, discriminated unions, intersections (a field either side knows is accepted), `z.lazy`, and the input side
  of a transform. The answer names the field and the fields its object accepts, e.g.
  `items.1: Unknown fields: "size". Accepted fields: "title".` An object with its own catchall (`z.looseObject`,
  `.catchall(x)`) keeps it; refinements and the object's own error messages stay.
- **Renamed fields:** a field sent under an old name where the object accepts the new one is refused with the
  stable code `input.field_renamed` and the new name, so a session on an older tool list learns it in one call.
  `renamedFields` is a map or a rule, e.g. `(field) => field.includes("Pln") ? field.replace("Pln", "Home") :
  undefined` for a rename across many fields; a name the rule leaves alone is an unknown field.
- **Text scalars:** a client on an older tool list sends a field it does not know as text, so a boolean field also
  takes the exact text `"true"`/`"false"` and a number field a JSON number written as text, converted before the
  field's own rules (`"-1"` still fails `min(0)`). Any other text is refused. The listed JSON Schema keeps `boolean`
  and `number`, the fields' `required` and the `default` of a scalar field, and gains `additionalProperties: false`.
  A required `z.number().nullable()` stays required. (zod lists no `default` on an object or array that holds a
  scalar field, since its input is transformed.)
- **No input schema:** a tool registered without one gets the strict empty object, so `tools/call` with any argument
  is refused; its handler is still called with the request context only.
- The SDK validates before the handler runs, so a refused call saves nothing. A raw shape is wrapped in
  `z.object` first; a schema that is not zod passes unchanged. `toStrictToolInput(schema, options?)` gives the
  strict schema on its own.

### Which build answers: `get_server_info`

An assistant checks a "done" against production in one call. `serverInfoTool` on `createMcpServerFactory` adds a
read-only `get_server_info` tool for every token, with no input fields, that answers the build info of
`@softure-ai/ops` (the same public facts as its build info route) and the name and version the server answered at
`initialize`, which follows the tool list:

```ts
import { readBuildInfo } from "@softure-ai/ops/server";

export const createServer = createMcpServerFactory({
  name: "acme",
  registerTools: (server, identity) => registerNoteTools(server, identity),
  serverInfoTool: {
    buildInfo: () => readBuildInfo(), // the route's options, when it has any
    changelog: () => changelog, // optional: the provider the build info route gets
  },
});
```

```json
{ "server": { "name": "acme", "version": "1.0.0-tools-3f9a0c41d2e7" }, "release": "v1.4.0", "commit": "abc1234",
  "builtAt": "2026-10-29T10:00:00.000Z", "startedAt": "2026-10-29T10:05:00.000Z", "changelog": [] }
```

- The app passes the reader, so `/server` never loads `@softure-ai/ops`; `McpBuildInfo` is its `BuildInfo` by shape.
- `changelog` appears only with a provider; a provider that fails answers `changelog: null` and logs the error
  class, as the route does. A failing `buildInfo` answers a tool error.
- The tool is part of the measured list, so turning it on changes the version once. The description comes from
  `serverInfoTool.description` of the dictionary, or `description` in the options.
- A hand-built server registers it with `registerServerInfoTool(server, { buildInfo, server: { name, version } })`,
  passing the name and version it serves.

### Writing tools

`/server` answers tools safely, so a failure never hands the assistant a query or an error's text:

```ts
import { actionTool, toolResult, withToolErrors } from "@softure-ai/mcp-access/server";

server.registerTool("list_orders", { description: "Lists your orders." }, () =>
  withToolErrors(() => findOrders(db, userId), { label: "list_orders", hints: { "orders.locked": "The shop is closed for stock-taking." } }),
);
if (canWrite) {
  server.registerTool("place_order", { inputSchema: z.object({ sku: z.string(), quantity: z.number() }) }, actionTool(
    (form) => placeOrderAction({ status: "idle" }, form),
    { message: "Order placed.", hints: { "orders.out_of_stock": "That item is out of stock." } },
  ));
}
```

- `toolResult(value)`: a string as text, anything else as JSON. `toolError(message)`: the same with `isError`.
- `withToolErrors(work, { hints?, label? })`: a `CallToolResult` passes; a result value is unwrapped (`ok` → its
  value, else the hint for its error code, else the code); any other value becomes `toolResult`. A thrown
  `PublicError` (core) gives its message. Anything else is logged by kind only (`errorLogLabel`, never the SQL or
  its parameters) and answered with the hint for its `safeError` code (`core.database_failed`, `core.unexpected`),
  else a fixed English text.
- `actionTool(handler, { message?, hints?, label? })`: the server action behind a form as a write tool, so both
  share one validation path. The arguments become `FormData` (numbers as text, `true` as `"on"`, `false` and `null`
  left out, arrays one entry per item, dates as ISO, objects as JSON). A `{ ok: false, error }` or
  `{ status: "error", error }` state is a tool error through the hints; otherwise the answer is `message` (text or
  `(state) => text`), else the state as JSON.

To keep a record of tool calls (a calls panel, usage figures), pass `onToolCall` with a `caller` built once per
request in the factory. The hook runs after each call with one record: `tool` (the `label`, else `"call"`),
`tokenId`, `clientName`, `argumentNames` (names only, never values), `outcome` (`succeeded` with `itemCount` for an
array value, `failed` with the result's error code, `thrown` with the `safeError` code, `null` for a
`PublicError`), `startedAt` and `durationMs`. The hook is awaited; when it throws, the failure is logged by kind and
the assistant gets the same answer. `findTokenClientName(ctx, tokenId)` gives the token's name (`null` for the stdio
id or a token that is gone).

```ts
export async function createServer({ userId, canWrite, tokenId }: McpServerIdentity) {
  const caller = { tokenId, clientName: await findTokenClientName(ctx, tokenId) };
  const onToolCall = (record: ToolCallRecord) => saveToolCall(db, userId, record);
  server.registerTool("list_orders", { inputSchema: { status: z.string() } }, (args) =>
    withToolErrors(() => findOrders(db, userId, args), { label: "list_orders", caller, args, onToolCall }),
  );
  // actionTool(handler, { label: "place_order", caller, onToolCall }) passes its arguments itself.
}
```

### Long operations: start, status, cancel

A tool whose work takes minutes (a render, an import) cannot hold the call open: the endpoint answers in JSON mode
and drops mid-call notifications, a proxy may cut a long response (Cloudflare at 100 seconds), and assistants time out
tool calls. `@softure-ai/mcp-access/jobs` turns such work into an operation on top of `@softure-ai/jobs`: the tool
starts a job and answers an id at once, the assistant asks `get_operation` until it ends, and may stop it with
`cancel_operation`.

```ts
import { registerOperationCancelTool, registerOperationStatusTool, startOperation } from "@softure-ai/mcp-access/jobs";

export async function createServer(identity: McpServerIdentity) {
  server.registerTool("render_video", { inputSchema: z.object({ videoId: z.string() }) }, (args) =>
    withToolErrors(() => startOperation(ctx, identity, { queue: "video.render", payload: args, dedupKey: `video:${args.videoId}` })),
  );
  registerOperationStatusTool(server, { ctx, identity, readResult: (job) => findRenderUrl(db, job.id) });
  registerOperationCancelTool(server, { ctx, identity }); // registers nothing without identity.canWrite
}
```

- `startOperation(ctx, identity, { queue, payload, dedupKey?, statusToolName?, poll? })` enqueues the job and answers
  `{ operationId, status: "queued", progress: null, pollAfterSeconds, message }`; the message tells the assistant to
  call the status tool and not to start again. With a `dedupKey` (at most 150 characters), starting again while the
  account's operation of that queue runs joins it: the answer carries its id and status.
- `get_operation` (`registerOperationStatusTool`, read only) answers `{ operationId, status, progress,
  pollAfterSeconds?, cancelRequested?, result?, errorCode?, message }`. `status` is `queued`, `running` (also while a
  failed attempt waits for its retry), `succeeded`, `failed` or `cancelled`; `progress` is what the handler reports
  with `context.reportProgress` (codes and counts only); `pollAfterSeconds` is there while the operation runs and
  grows with its age (a quarter of its seconds, between `poll.minSeconds` 2 and `poll.maxSeconds` 30); `result` is
  what `readResult(job)` reads from the app's tables once it succeeded (jobs stores no result); `errorCode` is the
  failure's code (`jobs.cancelled` for a cancelled one).
- `cancel_operation` (`registerOperationCancelTool`, a write) ends a queued operation at once and asks a running one
  to stop (`requestJobCancel`: the handler's `signal` aborts on its next heartbeat); the answer says
  `cancelRequested: true` until it has ended. An ended one answers "already ended" as a tool error.
- Scoped to the account: an operation's job has origin `mcp` and the dedup key `mcp:<userId>:<key>` (a random key
  without `dedupKey`). Another account's operation, a job that is not an operation and a malformed id all answer
  "No operation with this id belongs to this account." No table of its own: an operation lives as long as its job
  (`retention` of jobs).
- `getOperation` and `cancelOperation` are the same reads as functions; the texts are under `operations` in the
  module dictionary, and `name`/`description` rename a tool.

### Confirmed calls

A tool that spends money (a paid provider call) or cannot be undone follows the `--commit` rule over MCP:
`withConfirmation` (`/server`) makes the first call estimate only, the person agrees in the chat, and only a second
call with the same input does the work. The assistant cannot agree on its own: the token comes only from an estimate,
is single use and bound to that exact input.

```ts
import { confirmationInput, withConfirmation } from "@softure-ai/mcp-access/server";

server.registerTool(
  "render_film",
  { inputSchema: { scene: z.string(), seconds: z.number(), confirmation: confirmationInput } },
  withConfirmation((args) => renderFilm(ctx, userId, args), {
    ctx, // the module context, as for the app's queries
    identity, // the factory's McpServerIdentity: the token is bound to its userId and tokenId
    tool: "render_film",
    estimate: (args) => estimateFilm(ctx, userId, args), // { total: 12, currency: "credits", ... }
    runWithoutConfirmationWhen: (estimate) => estimate.total === 0, // everything was cached
  }),
);
```

- **First call** (no `confirmation`): runs `estimate(args)` only and answers
  `{ needsConfirmation: true, estimate, confirmation, expiresAt, message }`; `message` is the fixed sentence
  `confirmation.ask` of the dictionary, which tells the assistant to show the estimate and get the person's yes.
  `estimate` returns an object with a finite numeric `total`; every other field reaches the assistant as it is.
  When `runWithoutConfirmationWhen(estimate)` is true the handler runs at once instead.
- **The token** is an HMAC-SHA256 signed with `MCP_CONFIRMATION_SECRET` (§6, or the `secret` option) over the tool
  name, a digest of the canonical JSON of the arguments without `confirmation` (`toCanonicalJson`: keys sorted,
  `undefined` left out), a digest of the account and the access token, the estimate's total and the expiry
  (`ttlSeconds`, default 900).
- **Second call** (same arguments and `confirmation`): the estimate runs again, then the checks, each refused with its
  own code and the text of `confirmation.*` in the dictionary (an app's `hints` replace them):
  `input.confirmation_invalid` (not signed by this secret, malformed), `input.confirmation_other_tool`,
  `input.confirmation_other_account` (another account or access token), `input.confirmation_expired`,
  `input.confirmation_arguments_changed`, `input.confirmation_estimate_changed` (the total changed after the yes)
  and `input.confirmation_used`. Only when all pass is the token stored by its hash and the handler run with the
  arguments without `confirmation`; two parallel calls with one token run once. A refused call never uses up a valid
  token; a handler that fails after the check needs a new estimate.
- **The record**: `onToolCall` records gain `confirmed`: `true` for a call that ran on a valid confirmation, `false`
  for an estimate, a refusal or a call run through `runWithoutConfirmationWhen`, `null` for tools without
  confirmation. `argumentNames` leave `confirmation` out.
- `confirmationInput` is the field for the input schema (an optional string), so a strict server lists and accepts
  it. Without `MCP_CONFIRMATION_SECRET` the call fails as a bug, with one log line naming the variable: it never runs
  without asking.

### Stdio

A local assistant on the machine that holds the database can run the same factory over stdio, without a token:

```ts
// scripts/mcp-stdio.ts
import { serveMcpStdio } from "@softure-ai/mcp-access/stdio";
import config from "../softure.config";
import { createServer } from "../lib/mcp-server";

const started = await serveMcpStdio({ config, createServer, allowWrites: process.env.MCP_ALLOW_WRITES === "1" });
if (!started.ok) {
  console.error(started.error.message);
  process.exitCode = 1;
}
```

```bash
claude mcp add acme -e MCP_USER_ID=<account id> -- npx tsx --import @softure-ai/mcp-access/stdio/register scripts/mcp-stdio.ts
```

- The account: `MCP_USER_ID` (or `userIdEnv`) when set, which must name an account; else the only account in the
  database. With several accounts and no id the entry refuses (`mcp-access.stdio_account_ambiguous`): it never
  picks one. The lookup is `resolveOnlyAccount` from `@softure-ai/auth/server`, which an app's own scripts can use too.
- `canWrite` needs `allowWrites: true` here and the app's `allowWrites`. The token id is `"stdio"`.
- The database opens like a package command's (`database.handle`, else `database.url`) and closes with the
  connection. Messages go to stderr; stdout is the protocol.
- `@softure-ai/mcp-access/stdio/register` (`--import`) resolves `server-only` the way Next does (its `react-server`
  condition, the installed package's empty file), so a factory written for Next runs in plain Node, through a
  CommonJS `require` (`.cjs`, scripts tsx compiles to CommonJS) as well as an ES `import`. Without `server-only`
  installed, an ES import gets an empty module. It needs Node 22.15 or later (`module.registerHooks`).

### Catalog parity

```ts
// lib/mcp-server.test.ts
import { expectToolCatalogMatchesServer } from "@softure-ai/mcp-access/testing";

it("lists the same tools as the server", () => expectToolCatalogMatchesServer(config, createServer));
```

It lists the server's tools for a read-only and a write identity and throws naming every configured tool the
server lacks, every registered tool the catalog lacks, and every write tool a read-only token gets.
`getToolCatalogDifferences` returns the same as lists.

### Gating token issue

An app that checks something before a token is issued (a plan that includes write access) calls `issueToken` from
its own server action instead of copying `issueTokenAction`:

```ts
// app/account/mcp/actions.ts
"use server";
import { err, ok } from "@softure-ai/core";
import { issueToken } from "@softure-ai/mcp-access/next";
import type { IssueTokenFormState } from "@softure-ai/mcp-access";

export async function issueGatedToken(previous: IssueTokenFormState, form: FormData) {
  return issueToken(previous, form, {
    beforeIssue: async ({ userId, canWrite }) => (canWrite && !(await hasWritePlan(userId)) ? err("mcp-access.write_refused") : ok()),
  });
}
```

```tsx
// app/account/mcp/page.tsx
import { McpAccessPage } from "@softure-ai/mcp-access/next";
import { issueGatedToken } from "./actions";

export default function Page() {
  return <McpAccessPage issueAction={issueGatedToken} />;
}
```

The gate runs after the session check and before anything is issued. `mcp-access.write_refused` and
`mcp-access.issue_refused` have copy in `messages.errors["mcp-access"]` (override it per app). A gate with a sentence
per reason returns `refuseIssue(code, message)` (`/next`) or throws a `PublicError` (core, code `mcp-access.issue_refused`): the
form state carries the text as `message` and `TokenManager` shows it instead of the code's copy (a blank text falls
back to it). Any other thrown error becomes a `safeError` code. The gate stays in the app's code, out of
`softure.config.ts`.

```ts
beforeIssue: async ({ userId }) => {
  const plan = await getPlan(userId);
  if (plan.trialEnded) return refuseIssue("mcp-access.issue_refused", t("billing.trialEnded"));
  return ok();
},
```

The issued token carries `expiresText` (formatted in the app's locale and zone) and `expiresAt` (ISO 8601), for an
app that renders the expiry itself.

`TokenManager` (`@softure-ai/mcp-access/ui`) takes the actions `issueTokenAction` and
`revokeTokenAction` (`/next`) as props for an app that composes its own page, and `grants` with
`revokeGrantAction` for the connected apps list. It manages focus itself: the issued token's heading takes focus
when it appears, and "Done" returns focus to the name field.
`getTokenManagerProps({ userId })` (`/next`) builds every other
prop exactly as `McpAccessPage` does: `tools`, `tokens` (status, scope, created, expiry and last-use lines in the
config's locale and zone), `grants` only while `oauth.enabled`, `allowWrites`, `maxTokens`, `messages` and `locale`.
It checks no session: pass the signed-in user's id from the app's own check. For example, a page with its own `<h1>`:

```tsx
// app/account/mcp/page.tsx
import { requireUser } from "@softure-ai/auth/next";
import { getTokenManagerProps, issueTokenAction, revokeGrantAction, revokeTokenAction } from "@softure-ai/mcp-access/next";
import { TokenManager } from "@softure-ai/mcp-access/ui";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser({ next: "/account/mcp" });
  const props = await getTokenManagerProps({ userId: user.id });
  return (
    <main>
      <h1>{t("mcp.title")}</h1>
      <TokenManager
        {...props}
        issueAction={issueTokenAction}
        revokeAction={revokeTokenAction}
        {...(props.grants === undefined ? {} : { revokeGrantAction })}
      />
    </main>
  );
}
```

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
also refuses a request whose `Origin` is neither the app origin nor an http(s) origin on the host
the request was sent to (`Host`), the rule Next applies to Server Actions.
TypeScript's `**` skips dot folders: with an `include` list in `tsconfig.json`, add
`"app/.well-known/**/*.ts"`.

**Origins.** Every OAuth URL (issuer, endpoints, `resource`, `resource_metadata`, `iss`) and the
decision's `Origin` check use the app origin of the request: core's `resolveAppOrigin` (a listed
origin from the config's `origins` block the request was sent to, else `appOrigin`; core README,
"Request origins"), unless the module's `resolveAppOrigin` option answers. The decision also accepts a form posted from the host the request was
sent to, so an image with a fixed public origin run under another host (a release pipeline's
browser tests on `http://localhost:6510`) completes the consent without a resolver. The discovery
routes read the request, so Next never renders them at build time, and they answer with
`Vary: host, x-forwarded-host, x-forwarded-proto`. `getRequestOrigins(config, path)` from
`@softure-ai/mcp-access/next` gives a page or a server action the same origins from Next's `headers()`.

- *An image built once and served under another origin* (a test stack on another port, a
  production image against a local stack): `origins: { trustRequestHost: !process.env.APP_ORIGIN }`
  in the config (the older `resolveAppOrigin: readRequestOrigin` option does the same for this
  module only). It trusts `Host` and `X-Forwarded-Proto`, so use it only behind a proxy that passes
  `Host` through and refuses hosts it does not serve. The consent page,
  its decision and the token endpoint then agree on the origin the browser used.
- *A second public host* (product on `https://app.example.com`, site on `https://example.com`):
  `resourceOrigins: ["https://example.com"]`, and route that host's `/.well-known/oauth-*` to the
  app. Its root protected resource metadata names `https://example.com` as `resource` (RFC 9728
  §3.3) with the authorization server on the app origin; `Host` only picks among the listed
  origins.
- *Discovery extras:* keys the app adds and serves itself, computed from the request's origins:

  ```ts
  oauth: {
    enabled: true,
    metadata: {
      authorizationServer: ({ appOrigin }) => ({ jwks_uri: `${appOrigin}/.well-known/jwks.json` }),
      protectedResource: { resource_name: "Acme MCP server", resource_documentation: "https://example.com/docs/mcp" },
    },
  },
  ```

An app that composes its own routes from `/server` builds the context with
`createMcpAccessContext(config)` (`getMcpAccessContext()` in `/next` reads the registered config),
resolves origins with `resolveMcpOrigins(config, request)` and passes them to the URL builders,
whose last argument they are; `OAuthClientRow` is exported from the package root.

### Tokens for HTTP routes

A person who calls the app from outside the browser (an iPhone Shortcut, Make or Zapier, a script) gets a personal
token for the app's plain HTTP routes. Declare the scopes the routes ask for, and the buckets:

```ts
// softure.config.ts
security({ buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...MCP_RATE_LIMIT_BUCKETS, ...API_TOKEN_RATE_LIMIT_BUCKETS } }),
mcpAccess({
  serverName: "acme",
  allowWrites: true,
  apiTokens: {
    prefix: "acme_", // default "sftapi_"; never one of the module's own sftmc* prefixes
    scopes: [
      { name: "recipes:read", access: "read", description: { en: "Reads your recipes." } },
      { name: "recipes:write", access: "write", description: { en: "Adds and changes recipes." } },
    ],
    // Shown once with a new token; {token} and {appOrigin} are filled in.
    examples: [{ title: { en: "curl" }, text: { en: "curl -H 'Authorization: Bearer {token}' {appOrigin}/api/recipes" } }],
  },
}),
```

```ts
// app/api/recipes/route.ts
import { getSoftureConfig } from "@softure-ai/core/next";
import { apiTokenErrorResponse, createMcpAccessContext, requireApiToken } from "@softure-ai/mcp-access/tokens";

export async function POST(request: Request): Promise<Response> {
  const ctx = await createMcpAccessContext(getSoftureConfig());
  const caller = await requireApiToken(ctx, request, { scopes: ["recipes:write"] });
  if (!caller.ok) return apiTokenErrorResponse(caller);
  // caller.value: { userId, tokenId, scopes }; scope every query to userId.
  return Response.json(await addRecipe(caller.value.userId, await request.json()));
}
```

- **The two kinds stay apart.** An API token (`kind = 'api'`, the app's prefix) never opens `POST /api/mcp`, and an
  MCP token (`sftmcp_`, `mcp:read`/`mcp:write`) never passes `requireApiToken`. Both share the table, the hashing,
  `tokenLifetimeDays`, `maxTokensPerUser` (one count for both), the revoke action, privacy and prune.
- **Order of the check:** the client address is counted in `api` before any lookup, the `Authorization: Bearer`
  token is verified (expiry in the query, last use recorded), the token is counted in `api-token`, then the scopes.
- **Refusals are values** for `apiTokenErrorResponse`: `400 client_unidentified`; `401 api_token_missing` and
  `api_token_invalid` (unknown, revoked, expired, an MCP token) with `WWW-Authenticate: Bearer`; `403
  api_scope_missing` with `missingScopes` and `error="insufficient_scope"`; `403 api_writes_disabled` when the token
  holds the write scope but writing is off; `429 rate_limited` with `Retry-After`; `503 api_unavailable` (logged)
  when the count or the lookup fails. A scope the app does not declare, or missing buckets, throws: a setup bug.
- **Writes:** a `write` scope is granted at issue only with `allowWrites`, and counts on a request only while
  writing is enabled (`allowWrites` and the `mcp-access.writes_enabled` switch, §7).
- **The token page** lists the app's scopes and offers a second form, "New token for other apps", that posts to the
  same issue action with `kind=api` and a `scope:<name>` checkbox per offered scope. The new token is shown once
  with its header and the app's `examples`; the action answers `{ status: "api-ok", issued }`
  (`IssuedApiTokenView`), so an app reading `status === "ok"` for MCP tokens is unchanged. The list names each
  token's kind ("AI assistant", "Other apps") and an API token's scopes. A `beforeIssue` gate gets `kind` and
  `scopes`, with `canWrite` true when a write scope is asked.
- **Without MCP:** an app that has no MCP server enables `mcpAccess` with `apiTokens`, mounts only the token page
  and its routes, and imports `@softure-ai/mcp-access/tokens` (which loads no `@modelcontextprotocol/*` module). The
  npm peer list still names the SDK.
- Server functions: `issueApiToken`, `verifyApiToken`, `requireApiToken`, `apiTokenErrorResponse`,
  `isApiTokenShape`, plus `listAccessTokens`, `revokeAccessToken`, `pruneAccessTokens` (`/tokens`, also in `/server`).

### Closed registration

Registration is public by default: claude.ai and ChatGPT register a client before anyone signs in, and a client
grants nothing until a person consents. An app with one owner who adds the connector a few times a year can keep the
route shut with `oauth.registration: "closed"`. Closed, `POST /api/oauth/register` answers
`403 { "error": "access_denied", "error_description": "Client registration is closed." }` before it reads the body
(the request still counts in the `mcp-oauth` bucket); a failing read of the window answers `503`. The discovery
document keeps `registration_endpoint`, so a client that connects while registration is open finds it.

The operator opens a window for the minutes in which the owner adds the connector, with the safe ops scripts from
`@softure-ai/mcp-access/scripts` (`@softure-ai/ops` is an optional peer; dry run by default, `--commit` writes):

```ts
// scripts/open-client-registration.ts
import { runOpsScript } from "@softure-ai/ops/scripts";
import { createOpenClientRegistrationScript } from "@softure-ai/mcp-access/scripts";
import config from "../softure.config";

process.exitCode = await runOpsScript({ script: createOpenClientRegistrationScript(config), argv: process.argv.slice(2), config });
```

`open-client-registration --minutes=15 --commit` opens registration for 15 minutes (1 to 1440), replacing any open
window; `close-client-registration --commit` (`createCloseClientRegistrationScript`) shuts it early. Both refuse while
`oauth.enabled` is off or `oauth.registration` is `"open"`, and report the window's end before and after. Clients
registered in a window keep working after it ends; an unused one is pruned a day later like any other.

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
expired token, for a scheduled job (see "Scheduled pruning" below). Rollback: in the migration header.

`migrations/0002_create_oauth_grants.sql` creates `mcp.oauth_clients` (client id, name, redirect
URIs, auth method, sha256 of a confidential client's secret), `mcp.oauth_authorization_codes`
(sha256, PKCE challenge, redirect URI, single use through `used_at`) and `mcp.oauth_grants` (one
per account and client: write flag, sha256 of the current and the previous refresh token, refresh
expiry, last use), and adds `access_tokens.grant_id` (null for hand-issued tokens). Every row goes
with the account. `pruneOAuthRecords(ctx)` deletes expired codes, grants whose refresh token has
expired (with their access tokens) and clients registered over a day ago that hold no grant.

`migrations/0003_create_oauth_registration_window.sql` creates `mcp.oauth_registration_window`: at most one row
(`id = 1`) with `opened_at` and `open_until` (`open_until > opened_at`), the window of "Closed registration" (§4). It
holds no personal data.

`migrations/0004_create_used_confirmations.sql` creates `mcp.used_confirmations`: the sha256 of each confirmation
token that has been used (`token_hash`, the primary key), `used_at` and the token's `expires_at`, which makes a
confirmation single use ("Confirmed calls", §4). It holds no personal data; `pruneUsedConfirmations(ctx)` deletes the
rows past `expires_at`.

`migrations/0005_add_api_tokens.sql` adds `access_tokens.kind` (`mcp` or `api`, default `mcp`) and
`access_tokens.scopes` (`text[]`, default empty), with one check: an `mcp` row has no scopes, an `api` row has 1 to
32 scopes and no grant. Existing rows become MCP tokens through the defaults. An API token's `token_hash` is the
sha256 of its random part after the prefix (the prefix is checked by shape before any lookup). Rollback: in the migration header.

### Scheduled pruning

`pruneMcpAccess(ctx)` (`/server`) runs the prunes of tokens, OAuth records and used confirmations and counts what each removed. The `softure-mcp prune` command
runs it with the app's config (loaded like `softure migrate`, or from an app script through `runMcpAccessCli` from
`/cli`) and prints one line. Run it daily, e.g. as a `maintain` hook of `@softure-ai/deploy`:

```json
{ "hooks": { "maintain": [{ "name": "mcp-prune", "compose": ["exec", "-T", "app", "npx", "softure-mcp", "prune"] }] } }
```

An app that pruned inline on every token exchange can drop that code.

**With `@softure-ai/jobs`.** `@softure-ai/mcp-access/jobs` ships the handler and the schedule, so the worker runs the
cleanup instead of an app cron (`mcp-access.prune` daily; jobs README, "Schedules"):

```ts
// softure.config.ts
jobs({ schedules: { ...mcpAccessJobSchedules } }),
// src/jobs/handlers.ts (the worker's handlers)
export const handlers: JobHandlers = { ...mcpAccessJobHandlers /* , the app's own */ };
```
With it, drop the `mcp-prune` `maintain` hook.

`@softure-ai/jobs` is an optional peer: an app without it keeps calling the function from its own cron.

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
`baseline: { "mcp-access": 1 }`; file 2 then runs as a normal migration. File 3 and later always run as normal
migrations after the baseline.

## 6. Environment variables

The endpoint URL comes from `appOrigin` in `softure.config.ts`.

| Variable | Required | Meaning |
| --- | --- | --- |
| `MCP_CONFIRMATION_SECRET` | only for confirmed calls | Signs and verifies the tokens of `withConfirmation` (§4), at least 32 characters, read on every call. Changing it voids the tokens in flight (the person is asked again). |

## 7. Switches

`mcp-access.writes_enabled` (`WRITES_ENABLED_SWITCH`): a kill switch for writes, read through `readSwitch` of
`@softure-ai/core` on every MCP request, consent page and decision. `allowWrites` stays the configuration (no
writes at all without it); the switch takes writes away at once, without a deploy, when a token or a connected
assistant is suspected of misuse. Off, write tools are not served (the factory gets `canWrite: false`), the
challenge and the default OAuth scope name only `mcp:read`, and the consent page offers no write tick. Stored
tokens and grants keep their write access, so turning the switch back on restores it without new consent.

The app defines it in `@softure-ai/feature-switches`. Recommended: on by default, `failMode: "closed"` and
`override: "towards-fail-mode"`, so the environment variable `SOFTURE_SWITCH_MCP_ACCESS_WRITES_ENABLED=false`
can pull writes off but never push them back on:

```ts
featureSwitches({
  switches: [
    {
      name: "mcp-access.writes_enabled",
      label: { en: "Assistant writes" },
      description: { en: "Lets AI assistants with write access change data. Off, every assistant reads only." },
      default: true,
      failMode: "closed",
      override: "towards-fail-mode",
    },
  ],
});
```

An app that does not define it (or has no feature-switches) keeps `allowWrites` alone. A switch read that throws
counts as off and is logged by the switch's name. The stdio entry reads the switch once, when it starts.

## 8. Appearance

`TokenManager` slots: `root`, `section`, `heading`, `text`, `list`, `item`, `itemHeader`, `badge`,
`details`, `snippet`, `code`; `unstyled` renders structure only. `ConsentForm` and `ConsentError` slots: `root`,
`details`, `term`, `value`, `target` (where the code goes), `note` (the hint under it), `actions`, `text`, `link`;
`OAuthConsentPage` takes `classNames` and `unstyled` and passes them to both. Styling comes from
`@softure-ai/ui` classes on the `--sft-*` tokens; the module ships no CSS of its own.

## 9. Copy

`mcpAccessMessages.en`: `page`, `tools`, `issue`, `issued`, `setup.assistantPrompt`
(placeholders `{serverName}` and `{command}`), `list`, `grants` (connected apps), `consent` (the
consent page and its errors), and `errors` for the codes
`mcp-access.name_required`, `name_too_long`, `token_limit_reached`, `token_not_found`, `grant_not_found`,
`auth.unauthenticated`, `core.database_failed` and `core.unexpected`; `toolInput` for strict tool input
(`unknownFields` with `{fields}` and `{accepted}`, `noFields`, `fieldRenamed` with `{field}` and `{renamed}`).
Tool descriptions come from
the `tools` option, per locale.

## 10. Hooks

The MCP server factory passed to `createMcpRoute` (and to `serveMcpStdio`) and the `beforeIssue` gate of
`issueToken` are the module's hooks. `/server` also exports
`createMcpEndpoint({ createServer })`, a `(ctx, request) => Response` for hosts other than Next, and
`issueAccessToken`, `listAccessTokens`, `revokeAccessToken`, `verifyAccessToken` and
`pruneAccessTokens` for scripts. For OAuth: `listOAuthGrants`, `revokeOAuthGrant`,
`pruneOAuthRecords`, the registration window (`isClientRegistrationOpen`, `findClientRegistrationWindow`,
`openClientRegistration`, `closeClientRegistration`), the protocol steps (`registerMcpClient`, `createAuthorizationCode`,
`exchangeAuthorizationCode`, `refreshMcpGrant`) and the HTTP handlers behind the routes
(`handleClientRegistration`, `handleTokenRequest`, `handleAuthorizationDecision`,
`validateAuthorizationRequest`, `serveDiscoveryDocument`) for hosts other than Next.

## 11. GDPR

The rows hold no personal data beyond the owner's id and the token names. The module contributes
to `@softure-ai/privacy` (`privacy` flags on):

- **Export** (`exportMcpAccessUserData`): `accessTokens`, each hand-issued token's name, kind
  (`mcp` or `api`), scopes, write flag and created, expiry and last-use dates, and `connectedApps`, each grant's client name, write
  flag, created and last-use dates. Never a hash.
- **Deletion** (`deleteMcpAccessUserData`): the user's authorization codes, grants and tokens,
  before auth deletes the account (the foreign keys' cascade would remove them too). Registered
  clients hold no personal data and are pruned when unused.

## 12. Limitations / known gaps

- OAuth has no token introspection or revocation endpoint (RFC 7009) for clients: the person
  disconnects an app on the token page. Access tokens are opaque; the package serves no JWKS (an
  app that wants `jwks_uri` adds it through `oauth.metadata` and serves the empty set itself).
- Only `S256` PKCE and the `authorization_code` and `refresh_token` grants.
- Write access is per token, not per tool; finer scopes would be a new option.
- The MCP endpoint's rate limit is per client address, not per token (API tokens are counted per token as well).
- One API token kind per app (one prefix); the `kind` column takes more kinds without a migration of the rows.
- `responseMode: "json"` drops mid-call notifications; a streaming tool would need a different mode. Long work is an
  operation instead (start, `get_operation`, `cancel_operation`).
- Long operations answer through polling tools only; MCP Tasks (spec 2025-11-25, experimental) is not used yet.
