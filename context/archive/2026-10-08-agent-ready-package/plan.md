# Plan: agent-ready-package

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: large (one new package, eight phases).

## Goal

`modules/agent-ready` → `@softure-ai/agent-ready` 0.1.0 covering every point of issue #256, tested, documented, built
by `npm run build`, ready for its first publish.

**Out of scope (decided):** OAuth endpoints and the AS/PRM routes (mcp-access serves them, research §1); markdown
negotiation (#249, seo); MCP client setup snippets (mcp-access `getMcpClientSetup`); commerce protocols. The scan by
isitagentready.com (acceptance 2) runs against a deployment, so it lands in the adoption change of the app; this
change proves each scanner check's document shape in unit tests and ships the `verify` manifest that checks them
after a deploy.

## Key decisions

- **A SOFTURE module without a database**: `agentReady(options)` via `defineModule` (`dbSchema: null`, no tables, no
  migrations, empty `pl`/`en` dictionaries: every output is a machine format in English, as in seo). Route handlers in
  `./next` read it with `getSoftureConfig()`. Every builder is also exported pure (takes origins + resolved settings),
  so an app can compose its own route.
- **Origins**: `resolveOrigins(request, { appOrigin?, apexOrigin? })` returns `{ appOrigin, apexOrigin, requestOrigin }`.
  `requestOrigin` = first `X-Forwarded-Proto` (http/https, else the URL's scheme) + `Host` (else the URL's host);
  `appOrigin` = configured value, else `requestOrigin`; `apexOrigin` = configured value, else `appOrigin`; every value
  reduced to a bare origin (`trimOrigin` / `new URL().origin`). In the module: `options.appOrigin ?? config.appOrigin`
  when not empty, else the request; `options.apexOrigin` likewise. Rule: MCP and OAuth URLs on `appOrigin`;
  documentation, cards and catalogs on `apexOrigin`; the directory's `@authority` from the request.
- **OAuth**: mcp-access keeps the AS and PRM documents. agent-ready adds:
  - `buildAgentAuthMetadata({ appOrigin, apexOrigin, registrationEndpoint, ... })` → `jwks_uri`,
    `service_documentation`, `agent_auth { skill, register_uri }`, for mcp-access `oauth.metadata.authorizationServer`;
  - `buildResourceDocumentation` → `resource_documentation` for `oauth.metadata.protectedResource`;
  - `serveJwks` (`{ "keys": [] }`) and `getResourceMetadataUrl(appOrigin, mcpPath)`;
  - `auth.md` from the AS metadata object the app's provider returns (`oauth.authorizationServerMetadata(request)`,
    wired to mcp-access's `getAuthorizationServerMetadata`): every endpoint in it comes from that object, so the two
    cannot drift; a test runs it against mcp-access's real builder and checks every `*_endpoint`, `issuer` and
    `jwks_uri` value appears in the document. Without `oauth`, `/auth.md` answers 404 and cards point at the service doc.
- **MCP introspection** (`./server`): `readServerDescription(factory, { path, protocolVersion })` posts `initialize` and
  `tools/list` through `createMcpHandler(factory, { responseMode: "json" })`, reads JSON or the last SSE `data:` line,
  caches nothing (the factory decides the tools, e.g. writes on or off). Failure → the route answers 500 JSON.
  `@modelcontextprotocol/server` is a peer (`^2.0.0`).
- **Write tools**: `readOnlyHint !== true`; required scopes `[read, write]`, else `[read]`.
- **Skills**: options `skills: [{ name, description ≤ 1024, body: (origins) => string }]` and `mcpSkill`
  (`{ name? }`, default `<last segment of name>-mcp`, `false` to drop). The generated MCP skill lists connection,
  OAuth URLs (from the AS metadata when configured) and the introspected tools. Index and `SKILL.md` render from the
  same function, digest over the exact UTF-8 bytes.
- **AI catalog** entries: `mcp`, `a2a` (when enabled), `api-catalog`, one per skill; queries from
  `catalog.queries[entryId]` (2–5 each, validated), with defaults built from the title and description.
- **Web Bot Auth** (`./server`): port of the reference module with env names from options, `agentOrigin` = apex;
  `createSignedFetch(fetch, { agentOrigin, env })` never throws on signing; directory route signs with `binding0` and
  `"@authority";req` from `Host`.
- **DNS-AID**: `dnsAid: { domain, records: [{ label, target: "apex" | "app" | <host> }] }` (default `_index` → apex,
  `_mcp` → app); pure `resolveDnsAidRecords`, `formatZoneLine`, `parseSvcbData`, `evaluateDnsAid`; DoH in the CLI.
- **WebMCP** (`./webmcp`, no Node imports): types, `textResult`/`errorResult`, `findModelContext`,
  `registerWebMcpTool`, `fetchMarkdown`, and `buildWebMcpBootScript({ flag, paths, pathPatterns?, tools })` where each
  tool's `execute` is JavaScript source `(args, h) => …` with helpers `h = { ok, error, fetchMarkdown, stripFrontmatter }`;
  sources containing `</script` are refused.
- **CLI** `agent-ready`: `web-bot-auth key`, `dns-aid check --domain <d> --record <label>=<host> …`, and
  `check <url>` (re-downloads skill digests and verifies the directory signature). Exit 0/1/2.
- **Guards** (`./testing`, runner-agnostic, throw `Error`): `expectCatalogTargetsExist`, `findAppRoute` (file-system
  check of an `app/` folder), `expectSkillDigestsMatch`, `expectCardToolsMatchServer`, `expectNoAccountData`,
  `expectOriginMatrix`; `verifyManifest(options)` returns `deploy.json` `verify.routes` for one host.

## Phases

### Phase 1: scaffold, options, origins, Link header, API catalog, OpenAPI (TDD)

- Copy `templates/package/` to `modules/agent-ready`; manifest, `module.json`, `pl`/`en` empty dictionaries.
- `src/options.ts`, `src/origins.ts`, `src/paths.ts`, `src/settings.ts` (resolved settings from options + origins),
  `src/link-header.ts`, `src/api-catalog.ts`, `src/openapi.ts`, `src/index.ts`.
- Tests: module.json = manifest; defaults and refused options; origin rules (Host, X-Forwarded-Proto, `0.0.0.0` URL,
  trailing slash, fallbacks); relative Link header; catalog shape and content type; OpenAPI envelope, `$ref`s resolve,
  scopes and URLs on the app host.

Done when: gates green for the package.

### Phase 2: OAuth additions and auth.md (TDD)

- `src/oauth.ts`, `src/auth-md.ts`.
- Tests: extension keys; auth.md H1 and sections; parity with mcp-access's metadata (dev dependency) for every
  endpoint; lifetimes optional; no agentic registration claimed.

### Phase 3: introspection, server card, A2A card (TDD)

- `src/mcp-description.ts` (types, `isWriteTool`), `src/server-card.ts`, `src/a2a-card.ts`,
  `src/server/introspect.ts`.
- Tests with a real `McpServer`: tools follow the server (adding one changes the cards), writes on/off, both card
  shapes, binding `MCP`, no account id, JSON and SSE replies, failure.

### Phase 4: Agent Skills and AI catalog (TDD)

- `src/agent-skills.ts`, `src/mcp-skill.ts`, `src/ai-catalog.ts`.
- Tests: frontmatter, digest over bytes, unknown name, generated MCP skill lists the tools, catalog entries point at
  documents, 2–5 queries, identifiers.

### Phase 5: Web Bot Auth (TDD, oracle)

- `src/server/web-bot-auth.ts`, `createSignedFetch`; dev dependency `web-bot-auth`.
- Tests: RFC 9421 B.1.4 key and keyid, signatures verified by the reference library, wrong host fails, missing key →
  no headers and no log, malformed key logged by name, retired keys, signed fetch never throws, directory signature.

### Phase 6: DNS-AID (TDD)

- `src/dns-aid.ts`; tests port the reference cases (presentation and generic forms, truncation, HTTPS records,
  SERVFAIL, AD flag, DS).

### Phase 7: WebMCP runtime (TDD)

- `src/webmcp/index.ts`; tests in happy-dom: detection, both registration generations, rejection logged, boot script
  escaping, path allow-list, flag, refused `</script`, `fetchMarkdown`.

### Phase 8: Next routes, CLI, guards, verify manifest, docs

- `src/next/*` (handlers + `nextHeaders`), `src/cli/*` (bin), `src/testing/index.ts`, `src/verify.ts`.
- Tests: every route's status, content type, cache and CORS headers, dynamic export; origin matrix through the
  handlers (apex and app `Host`, with and without configured origins, `X-Forwarded-Proto`); 404 directory without a
  key; guards each with a failing case; CLI exit codes with injected fetch/IO.
- README (twelve sections + "Parity with the reference implementation"), CHANGELOG `## Unreleased`, root README
  package list, docs links.

Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

- [x] Phase 1: scaffold, options, origins, Link header, API catalog, OpenAPI: `cda3865`
- [x] Phase 2: OAuth additions and auth.md: `cda3865`
- [x] Phase 3: introspection, server card, A2A card: `cda3865`
- [x] Phase 4: Agent Skills and AI catalog: `cda3865`
- [x] Phase 5: Web Bot Auth: `cda3865`
- [x] Phase 6: DNS-AID: `cda3865`
- [x] Phase 7: WebMCP runtime: `cda3865`
- [x] Phase 8: Next routes, CLI, guards, verify manifest, docs: `cda3865`

The eight phases landed in one commit (`cda3865`): the builders share the context, options and test support, so
they were written and tested together. The implementation review's fixes follow in the next commit
([reviews/impl-review.md](reviews/impl-review.md), triage).

## Decisions after review

From [reviews/plan-review.md](reviews/plan-review.md):

- **One origin resolution (F1, F2).** agent-ready resolves `{ appOrigin, apexOrigin, requestOrigin }` with
  `resolveAppOrigin` (same shape as mcp-access's) → `appOrigin` option → `config.appOrigin`. The AS metadata provider
  is called with a request rebuilt on the resolved app origin, so mcp-access computes the same issuer. README: set
  mcp-access `resourceOrigins: [apex]` so its root PRM on the apex names the apex. Tests use mcp-access's real
  builders (dev dependency) on both hosts.
- **Extension adapter (F3).** `createAgentAuthExtension({ apexOrigin, registerPath = "/api/oauth/register",
  serviceDocPath })` → `(origins) => { jwks_uri, service_documentation, agent_auth }`; parity test with mcp-access.
- **Verify (F4).** `verifyManifest({ host: "apex" | "app", ... })` returns `verify.routes` for that host: status +
  `content-type` per document, one `/` route per Link rel, `agent_auth.skill` and root PRM markers as quoted values,
  `POST <mcp>` → 401 with `resource_metadata`, `# auth.md` H1, `modelContext` on `/`. `agent-ready check <url>`
  re-downloads skills and verifies the directory signature (exit 0/1/2).
- **Options (F5).** As in `src/options.ts`: `appOrigin`, `apexOrigin`, `resolveAppOrigin`, `name`, `title`,
  `description`, `provider`, `mcp { path, server, protocolVersions }`, `scopes`, `oauth { authorizationServerMetadata,
  manualTokenPath, lifetimes }`, `serviceDoc`, `openapi`, `apiCatalog.statusPath`, `skills`, `mcpSkill`,
  `catalog.queries`, `a2a { enabled, skillTags }`, `webBotAuth`, `dnsAid`, `markdown`. No environment reads in the
  module (the app passes `process.env` values in its config, as for every module); prose is in English, overridable
  through `description`, `openapi.*` and `serviceDoc.title`; the dictionaries stay empty (machine formats, as seo).
- **Sources (F6).** OAuth URLs in OpenAPI, auth.md and the MCP skill come from the provider's metadata; scopes from
  `scopes`; without `oauth` they name the bearer token only.
- **OpenAPI contract (F7).** A test pins the digest of the default envelope to `openapi.version`'s default.
- **Boundaries (F8).** Architecture test over imports; `nextHeaders` in the root and `./next`.
- **Headers (F11).** JSON with 2-space indentation; `access-control-allow-origin: *`; `cache-control: public,
  max-age=3600`, 300 for skills and the AI catalog; directory 404 `no-store`.
- **Done when (F9).** Each phase: its tests green, `npm run typecheck` and `npm run lint` clean.
- **Owner step (F20).** First publish needs a fresh `NPM_TOKEN` secret; the isitagentready.com scan runs in the
  app's adoption change.
