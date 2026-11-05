# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/mcp-access`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`mcp-access@x.y.z`).

## Unreleased

- The served tool contract in `get_server_info` (#1078): `serverInfoTool: { tools: true }` makes the tool answer each
  served tool's `name`, `description` and `inputSchema` for the caller's access level, exactly as `tools/list` answers
  them (the measured list the version comes from), with a `toolsHint` that the server's copy is current. An optional
  `name` input narrows it to one tool; an unknown name answers `toolNames`. A hosted client never caches a tool result,
  so a model on a stale tool list reads the current one in-band. `registerServerInfoTool` takes `tools` with
  `servedTools` for a hand-built server. Migrate: nothing (off by default; turning it on changes the version once).

## 0.6.0

- Request diagnostics (#1066): `createMcpEndpoint({ diagnostics })` (and so `createMcpRoute`), off by default. `true`
  logs one `console.info` line per request, a function receives each `McpRequestDiagnostic` instead: the JSON-RPC
  method, the tool name of a `tools/call`, the session state (`none`, `current`, `stale` with the version it carries,
  `not_issued`, `unchecked`), the served tool list version, whether a session id was issued, the status, and on
  `initialize` the client's `clientInfo` and protocol version. Never a token, body, argument value, session id or
  user identity. The README says what hosted clients do with a changed tool list. Migrate: nothing.

## 0.5.0

- Sessions that follow the tool list (#1055): `createMcpEndpoint` answers `initialize` with an `Mcp-Session-Id` that
  carries the tool list version of the identity's access level, and answers `404 Not Found` to a request whose session
  carries another version, so a connected client initializes again and re-lists the tools after a release that
  changed one, without reconnecting the connector. Stateless: nothing is stored. A request without a session id is
  served as before. `initialize` now declares `tools.listChanged: false`, since the endpoint never sends the
  notification. `createMcpServerFactory` returns a factory with `toolListVersion(identity)`; a hand-written factory
  passes `toolListVersion` to `createMcpEndpoint` to get sessions. `/testing` adds
  `expectToolListSessionRenewed(before, after)`. Migrate: nothing for an app on `createMcpServerFactory`.

## 0.4.0

- Operation tools with a context getter (#990), in `@softure-ai/mcp-access/jobs`: `registerOperationStatusTool`,
  `registerOperationCancelTool` and `registerOperationTasks` take `getContext: () => Promise<JobsContext>` instead of
  `ctx`, resolved inside each call (never at registration, so listing the tools opens no database), with an optional
  `config` for the tool descriptions (default: the English dictionary). The error sentences now come from the config
  of the call. `getOperationErrorHints(config)` exports the hints for `mcp-access.operation_not_found` and
  `mcp-access.operation_finished`, for an app that wraps `getOperation` or `cancelOperation` itself. `{ ctx }` works
  as before. Migrate: an app that registered its own `get_operation` / `cancel_operation` around a per-call context
  can drop them and pass `getContext` (README "Long operations").

## 0.3.0

- Long operations as MCP Tasks (#977), in `@softure-ai/mcp-access/jobs`: `startOperation` takes `taskRequest` (the
  tool handler's request context) and `taskTtlSeconds`; when the client declared the Tasks extension
  (`io.modelcontextprotocol/tasks`, revision 2026-07-28) on that request, the tool answers a task instead of an
  operation id. `registerOperationTasks(server, { ctx, identity, readResult?, poll? })` declares the extension and
  serves `tasks/get` (working, completed with the `get_operation` answer, `isError` for a failed operation, cancelled),
  `tasks/update` and `tasks/cancel` (write access only), scoped to the account. Task ids are random and live in the
  new table `mcp.operation_tasks` (migration `0006`), pruned past their expiry by `pruneMcpAccess` (which now also
  counts `operationTasks`, and `softure-mcp prune` prints it) and deleted with the account. Every other client keeps the
  polling tools. Migrate: run `softure migrate`; to offer tasks, pass the handler's second argument as `taskRequest`
  and call `registerOperationTasks` on the same server (README "As MCP Tasks").
- Long operations as tools (#952), in `@softure-ai/mcp-access/jobs` on top of `@softure-ai/jobs` (with the progress
  and running-job cancel of jobs #951): `startOperation(ctx, identity, { queue, payload, dedupKey? })` enqueues and
  answers `{ operationId, status: "queued", pollAfterSeconds, message }` at once; `registerOperationStatusTool`
  (`get_operation`) answers the status, the handler's progress, a growing `pollAfterSeconds`, the app's `result`
  (`readResult`) and the `errorCode`; `registerOperationCancelTool` (`cancel_operation`, write access only) cancels a
  queued operation and asks a running one to stop. Operations are scoped to the caller's account; no migration.
  Migrate: an app with its own "start returns an id" and "status" tools can replace them with these (README "Long
  operations").
- Personal tokens for the app's plain HTTP routes (#961): the option `apiTokens` (`prefix`, default `sftapi_`;
  `scopes` with `read`/`write` access and a description; `examples` for the one-time reveal) turns on a second token
  kind. `requireApiToken(ctx, request, { scopes })` checks a route's request: client address counted (bucket `api`),
  Bearer token verified, token counted (bucket `api-token`), scopes and the write switch checked; refusals are values
  that `apiTokenErrorResponse` answers (400/401/403/429/503). The new entry `@softure-ai/mcp-access/tokens` exports
  it with `issueApiToken`, `verifyApiToken`, list, revoke and prune, and loads no MCP SDK. An API token never opens
  the MCP endpoint and an MCP token never passes the check. The token page lists the app's scopes, adds the form
  "New token for other apps" (`kind=api`, `scope:<name>` fields), shows the token once with the app's examples
  (form state `api-ok`, `IssuedApiTokenView`) and names each token's kind. `AccessTokenView` gains `kind` and
  `scopes`; the gate input `kind` and `scopes`; the privacy export `kind` and `scopes`. Both kinds share
  `maxTokensPerUser`. Migration `0005_add_api_tokens.sql` adds `kind` and `scopes` (existing rows stay MCP tokens).
  Migrate: nothing for an app without `apiTokens`, apart from running the migration; an app that compares
  `listAccessTokens` or the privacy export field by field gains the two fields. To use it, add `apiTokens`, spread
  `API_TOKEN_RATE_LIMIT_BUCKETS` into `security({ buckets })` and call `requireApiToken` in the routes.
- Confirmed tool calls (#953): `withConfirmation(handler, { ctx, identity, tool, estimate, ttlSeconds?,
  runWithoutConfirmationWhen?, secret? })` (`/server`) makes a priced or irreversible tool estimate first and answer
  `{ needsConfirmation: true, estimate, confirmation, expiresAt, message }`; the second call with the same arguments
  and the token does the work. The token is an HMAC bound to the tool, the canonical arguments, the account and access
  token, the estimate's total and the expiry, single use (stored by hash in the new `mcp.used_confirmations`), and a
  mismatch is refused as `input.confirmation_invalid`, `_other_tool`, `_other_account`, `_expired`,
  `_arguments_changed`, `_estimate_changed` or `_used`. `confirmationInput` is the schema field. `ToolCallRecord`
  gains `confirmed: boolean | null` (`null` for other tools), and `pruneMcpAccess` counts `usedConfirmations`.
  Migrate: run `softure migrate` (file 4). To confirm a tool, set `MCP_CONFIRMATION_SECRET` (32+ characters), add
  `confirmation: confirmationInput` to its input schema and wrap its callback; drop an app-level `confirm: true`
  boolean the assistant could set itself. A test that builds a `ToolCallRecord` by hand adds `confirmed: null`.
- Strict tool input lists a required nullable scalar as required (#919): a `z.number().nullable()` or
  `z.boolean().nullable()` field that the parse requires is in `required` of the listed schema again, and a scalar
  field's `default` (or `prefault`) is listed. The parse rules are unchanged. Migrate: an app that copied the inner
  schema's `optin` onto its own text step, or put a `default` inside it, can drop that wrapper.
- A tool registered without an input schema on a strict server gets the strict empty object (#919): `tools/call`
  with any argument is refused with the unknown-fields text, and the handler is still called with the context only.
  The listing gains `additionalProperties: false`, so the measured tool list version changes once.
- `renamedFields` also takes a rule `(field) => newName | undefined` (#919), e.g. for a rename by pattern across many
  fields. `RenamedFields` is exported from `/server`.

## 0.2.9

- A runtime kill switch for writes (#904): the manifest switch `mcp-access.writes_enabled` (`WRITES_ENABLED_SWITCH`)
  is read through `readSwitch` on every request. Writes need `allowWrites`, the token's write access and the switch;
  off, write tools are not served, the `WWW-Authenticate` challenge and the default OAuth scope name only `mcp:read`,
  the consent page offers no write tick and a decision grants read only. `isWritingEnabled(ctx)` (`/server`) answers
  the app's side, and `AuthorizationRequest.isWriteOffered` the consent page's. Migrate: nothing; an app that does
  not define the switch behaves as before. To use it, define it in `@softure-ai/feature-switches` (README §7
  recommends `failMode: "closed"`, `override: "towards-fail-mode"`) and drop an app-level write switch.
- The consent page shows where the access code goes as a row of its own (#906): `consent.redirectLabel` and the
  host (or the whole native-scheme URI) in monospace, with the hint `consent.redirectHint` that the app name is
  self-declared and the address is not. `ConsentForm` gains the `target` slot; `note` now styles the hint.
  `OAuthConsentPage` takes `classNames` and `unstyled` and passes them to `ConsentForm` and `ConsentError`.
  Migrate: `consent.returnsTo` is gone; an app that overrides it moves its text to `consent.redirectLabel`, and an
  app that recomposed the page to show the host can mount `OAuthConsentPage` again.

## 0.2.8

- The content of 0.2.7, which was never published: its release stopped at the gates (ESLint ran out of memory in
  `release.yml`) before publishing, and a tag is never moved.

## 0.2.7

- A `get_server_info` tool (#885): `serverInfoTool: { buildInfo, changelog?, description? }` on
  `createMcpServerFactory` (`/server`) adds a read-only tool with no input fields for every token that answers the
  build info (pass `readBuildInfo` of `@softure-ai/ops/server`), the optional changelog and the served name and
  version, so an assistant checks which build answers in one call. `registerServerInfoTool(server, { buildInfo,
  server: { name, version } })` registers it on a hand-built server. Its description is
  `mcpAccessMessages.en.serverInfoTool.description`. Migrate: nothing; opt in to use it.
- Strict tool input (#876): `withStrictToolInput(server, { renamedFields?, coerceTextScalars?, messages? })`
  (`/server`), or `strictToolInput` on `createMcpServerFactory`, rewrites every input schema at registration. Unknown
  fields are refused at every level with the fields the object accepts, a field under its old name is refused as
  `input.field_renamed` with the new name, and boolean and number fields also take their exact text. Texts live in
  `mcpAccessMessages.en.toolInput`. The listed schemas gain `additionalProperties: false`, so the tool-list version of
  a server that opts in changes once. Migrate: an app that wraps `registerTool` itself replaces it with the option.
- A server version that follows the tool list (#877): `createMcpServerFactory({ name, release?, version?, title?,
  serverOptions?, registerTools(server, identity) })` (`/server`) returns an `McpServerFactory` whose servers answer
  `initialize` with `<release>-tools-<12 hex>`, a fingerprint of every tool as `tools/list` serves it, measured once
  per access level, so MCP clients drop a cached tool list whenever a release changes a tool.
  `measureToolList(registerTools, { release?, name?, serverOptions? })` → `{ toolListVersion, toolCount }` measures a
  list by hand; `measureServedToolLists(createServer)` (`/testing`) reports both levels for a snapshot. Migrate: an
  app that derives the version itself on a recording server replaces it with the factory, or with `measureToolList`
  when its tool list depends on the account.
- The catalog check treats a server with no tools as an empty list instead of failing to list it.

## 0.2.6

- A hook around each tool call (#804): `withToolErrors` and `actionTool` take optional `onToolCall`, `caller`
  (`{ tokenId, clientName }`) and, for `withToolErrors`, `args`. The hook gets one `ToolCallRecord` per call: tool
  name, token id, client name, argument names (never values), outcome (`succeeded` with an item count, `failed` with
  the error code, `thrown` with the `safeError` code), start and duration. A failing hook is logged by kind and never
  changes the answer. `findTokenClientName(ctx, tokenId)` (`/server`) gives the token's name. Migrate: an app that
  wraps each tool's work inside `withToolErrors` to read the raw result and time it, and looks up
  `mcp.access_tokens.name` itself, drops both and passes `{ caller, args, onToolCall }` instead. `actionTool` now
  answers an error state through `withToolErrors`'s result path; the answer is the same.

## 0.2.5

- `TokenManager` keeps keyboard focus (#590): when the issued token appears, focus moves to its heading
  (`tabIndex={-1}`), so a screen reader announces the token that is shown only once; "Done, hide the token" returns
  focus to the issue form's name field instead of dropping it to `<body>`. Migrate: nothing to change; an app that
  moved focus itself around `TokenManager` can drop that code.
- `getTokenManagerProps({ userId, config?, now? })` in `/next` (#589): every data prop of `TokenManager` (`tools`,
  `tokens`, `grants` while OAuth is on, `allowWrites`, `maxTokens`, `messages`, `locale`), built exactly as
  `McpAccessPage` builds them, which now renders through it. For an app that composes its own page around
  `TokenManager` (its own `<h1>`, its own frame). It checks no session: pass the signed-in user's id. Migrate: an app
  that copied the page's builders (`toRow`, `toGrant`, `toTool`, `describeStatus` and the date formatting) deletes
  them and spreads `await getTokenManagerProps({ userId: user.id })` into `TokenManager`, adding only the actions
  (`revokeGrantAction` only when `grants` is present). Its output is unchanged.

## 0.2.4

- `stdio/register` works for CommonJS (#571): it resolved `server-only` to a `data:` module, which an ES `import`
  loads but a CommonJS `require` reads as a file path (`ENOENT … open 'data:text/javascript,…'`), so every `.cjs` file
  and every script tsx compiles to CommonJS failed. It now resolves the installed `server-only` through its
  `react-server` condition to the package's empty file, which both loaders open; nothing else resolves differently.
  Migrate: an app that seeds `require.cache` for `server-only` (with `server-only/empty.js`) in its scripts or its
  stdio entry drops that shim and keeps only `--import @softure-ai/mcp-access/stdio/register` (`node` or `tsx`).

## 0.2.3

- OAuth clients now ask for writes (#553): while `allowWrites` is on, the endpoint's `401` challenge names
  `scope="mcp:read mcp:write"` (it named only `mcp:read`, and clients such as claude.ai request the challenge's scope,
  so the consent page never offered writes). An authorization request without `scope` now gets both scopes while
  `allowWrites` is on (RFC 6749 §3.3 default). The person's tick on the consent page still decides; with
  `allowWrites` off nothing changes. Migrate: an app that wrapped the MCP route to rewrite the challenge's `scope`, or
  defaulted a missing `scope` on its consent page, drops that workaround. Grants made before stay read-only: the
  person disconnects and reconnects the app once to be offered writes.

## 0.2.2

- `oauth.registration` (#520): `"closed"` keeps `POST /api/oauth/register` shut (`403 access_denied`) except while a
  window opened by the new `open-client-registration --minutes=N` ops script lasts; `close-client-registration` shuts
  it early. Both come from the new `@softure-ai/mcp-access/scripts` entry; `@softure-ai/ops` (^0.2.0) is a new
  optional peer. The default `"open"` changes nothing. Migrate: run `softure migrate` (file 3 adds
  `mcp.oauth_registration_window`; the health check reads it). An app that adopted its own tables keeps
  `baseline: { "mcp-access": 2 }`.

## 0.2.1

- `@softure-ai/mcp-access/jobs` (#491): `mcpAccessJobHandlers` and `mcpAccessJobSchedules` run `pruneMcpAccess`
  daily as a `@softure-ai/jobs` schedule; `@softure-ai/jobs` (^0.1.1) is a new optional peer. Migrate (optional): an app with
  `@softure-ai/jobs` adds `...mcpAccessJobSchedules` to `jobs({ schedules })` and `...mcpAccessJobHandlers` to its
  worker's handlers, then drops the `softure-mcp prune` `maintain` hook (or its own cron). Without jobs nothing
  changes; `softure-mcp prune` stays.

## 0.2.0

- **Breaking (#446):** the built-in `pl` dictionary is gone; English is the only built-in copy and the fallback for
  every other locale, which is now any BCP 47 tag. Migrate: an app that shows Polish keeps its own translation and
  passes it as the overrides for its locale, `mcpAccess({ messages: { pl: myTranslation } })`; a key it leaves out
  reads English. Tool texts take any locale key.

## 0.1.15

- The stdio entry resolves its account with `resolveOnlyAccount` from `@softure-ai/auth/server` instead of a private
  copy; codes and messages are unchanged (#411). Needs the auth release that exports it.
- The `@softure-ai/ui` peer range also accepts 0.2.0.
- Requires `@softure-ai/auth` `^0.1.13`, the release with `resolveOnlyAccount` (#411).

## 0.1.14

- `issueToken` can replace an app's own token-issue action (#386):
  - `mcpAccess({ clientServerName })` (default `serverName`): the name the setup snippets register the server under
    (`claude mcp add`, the JSON configs, the assistant prompt), so users keep the entry they already added.
  - The `beforeIssue` gate refuses with its own text: `refuseIssue(code, message)` (`/next`, an `Err` with a
    `message`), or a thrown `PublicError` (code `mcp-access.issue_refused`). `IssueTokenFormState`'s error carries it
    as `message`, which `TokenManager` shows instead of the code's copy. `McpIssueRefusal` (root) and
    `IssueGateResult` (`/next`) are exported.
  - `IssuedToken.expiresAt` (ISO 8601) next to `expiresText`.

## 0.1.13

- Token and grant dates use core's `formatCalendarDay` on the day in the app's zone; same output. Requires
  `@softure-ai/core` `^0.1.9` (#312).
- What an adopting app wrote around the endpoint ships with the package (#315):
  - `toolResult`, `toolError` and `withToolErrors(work, { hints, label })` (`/server`): a thrown error reaches the
    assistant only as a `PublicError` message or a hint, and the log only by kind, never with its SQL.
  - `actionTool(handler, { message, hints })` (`/server`): a server action as a write tool, its arguments sent as
    the form the action reads.
  - `@softure-ai/mcp-access/stdio`: `serveMcpStdio({ config, createServer, userIdEnv, allowWrites })` serves the
    factory over stdio for the account in `MCP_USER_ID`, or the only account; `/stdio/register` resolves
    `server-only` to an empty module for `node`/`tsx --import`.
  - `@softure-ai/mcp-access/testing`: `expectToolCatalogMatchesServer(config, createServer)` and
    `getToolCatalogDifferences`. Catalog tools take optional localized `title` and `example`.
  - `DEFAULT_MCP_ACCESS_ROUTES` from the root entry; the manifest uses it.
  - `issueToken(previous, form, { beforeIssue })` (`/next`) for a gate before a token is issued, with the codes
    `mcp-access.issue_refused` and `mcp-access.write_refused` (copy in en and pl); `McpAccessPage` takes an
    optional `issueAction`. `issueTokenAction` is unchanged.
  - `pruneMcpAccess(ctx)` (`/server`) and the `softure-mcp prune` command (bin, `/cli`) for a daily job such as a
    deploy `maintain` hook.

## 0.1.12

- Without a `resolveAppOrigin` option, the app origin comes from core's `resolveAppOrigin` (#311): a listed origin
  from the config's `origins` block the request was sent to, else `appOrigin`; `origins.trustRequestHost` replaces
  `resolveAppOrigin: readRequestOrigin`. `readRequestHost` and `readRequestOrigin` are core's (`readRequestOrigin`
  answers `null` for a host that is no host). The consent decision still reads `Host` only. Discovery documents vary
  on `x-forwarded-host` too.
- `getRequestOrigins(config, path)` is exported from `@softure-ai/mcp-access/next`. Needs `@softure-ai/core` 0.1.8.
- `MCP_RATE_LIMIT_BUCKETS` declares `key: "ip"` on `mcp` and `mcp-oauth` (security 0.1.8 bucket kinds).
- Requires `@softure-ai/security` `^0.1.8`: earlier versions refuse the `key` field.

## 0.1.11

- The consent decision accepts a form whose `Origin` host is the host the request was sent to
  (`Host`), next to the app origin it accepted before, like Next's Server Action check. An image
  with a fixed public origin run under another host (browser tests on `http://localhost:6510`)
  no longer gets `403`. Other hosts, `Origin: null`, a missing or malformed `Origin` and
  non-http(s) schemes are still refused; `iss` and `resource` still use the app origin (#294).

## 0.1.10

- The days left on a token are counted with `toCalendarDay` from `@softure-ai/core` instead of a local `en-CA`
  formatter. Same results; requires `@softure-ai/core` `^0.1.7` (#270).

## 0.1.9

- The OAuth registration, token and consent decision routes read their body through `readSmallBody`
  with a cap, `oauth.maxBodyBytes` (default 16 KiB, 1 KiB to 1 MiB). A larger body, announced or
  streamed, is answered with `413` (`invalid_request` on registration and token, an empty `413` on
  the decision) before it fills memory; an oversized token request still counts in the `mcp-oauth`
  bucket, per address. Unreadable bodies (cut off, not UTF-8) get the answer each route gave before.
  The consent form is parsed from the capped text, so urlencoded and multipart forms both work.

## 0.1.8

- OAuth URLs follow the request: `resolveAppOrigin(request)` (with `readRequestOrigin`, which reads
  `Host` and `X-Forwarded-Proto`) sets the app origin per request for the issuer, the endpoints in
  the metadata, `resource`, `resource_metadata` in the endpoint's `401`, `iss` and the consent
  decision's `Origin` check. Without it nothing changes.
- `resourceOrigins`: other public hosts; the root protected resource metadata asked on one names it
  as `resource`, and the authorization and token endpoints accept it.
- `oauth.metadata.authorizationServer` / `.protectedResource`: extra discovery keys (an object, or
  a function of the request's origins); generated keys win, `resource_name` can be replaced.
- Discovery documents carry `Vary: host, x-forwarded-proto`; `getAuthorizationServerMetadataRoute`
  now reads the request (re-exporting it as `GET` keeps working).
- New exports: `createMcpAccessContext` and `resolveMcpOrigins` (`/server`), `getMcpAccessContext`
  (`/next`), `OAuthClientRow`, `McpOrigins` and `readRequestOrigin` (root and `/server`). URL
  builders take the origins as an optional last argument.

## 0.1.7

- OAuth 2.1 for MCP clients, opt-in (`oauth.enabled`): protected resource and authorization server
  metadata, `resource_metadata` in the endpoint's `401`, dynamic client registration, a consent
  page with PKCE `S256`, a token endpoint with rotating refresh tokens and replay detection, and a
  connected apps list whose revoke deletes the grant's access tokens. Mount the new routes and the
  consent page (README §4) and add `"mcp-oauth"` from `MCP_RATE_LIMIT_BUCKETS` to the security buckets.
- Separate lifetimes: `tokenLifetimeDays` for hand-issued tokens, `oauth.accessTokenLifetimeMinutes`,
  `oauth.refreshTokenLifetimeDays` and `oauth.authorizationCodeLifetimeMinutes` for OAuth.
- `legacyTokenPattern`: tokens an app issued before adopting the module keep working.
- Migration 2 (`create_oauth_grants`) adds the OAuth tables and `access_tokens.grant_id`.
- `adoption/move-app-tables.sql`: moves an app's own token and OAuth tables into `mcp` for
  `baseline: { "mcp-access": 2 }` (README §5).

## 0.1.6

- Adapters use the configured database handle; `@softure-ai/ui` is a peer dependency.
