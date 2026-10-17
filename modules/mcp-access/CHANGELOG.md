# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/mcp-access`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`mcp-access@x.y.z`).

## Unreleased

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
