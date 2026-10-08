# Implementation review: agent-ready-package

- Date: 2026-10-08
- Commit reviewed: `cda3865` (the whole package in one commit; working tree clean)
- Inputs: `change.md`, `research.md`, `plan.md` (incl. "Decisions after review"), `reviews/plan-review.md`; every file
  under `modules/agent-ready/src` and `modules/agent-ready/tests`; `README.md`, `CHANGELOG.md`, `package.json`,
  `module.json`; `modules/mcp-access/src/{options.ts,server/origins.ts,server/oauth-http.ts}` and
  `tools/deploy/src/verify/schema.ts` for the contracts.
- Gates run: `npx vitest run modules/agent-ready`: 13 files, 134 tests green. `npx tsc -p modules/agent-ready/tsconfig.json`:
  clean. Lockfile carries the workspace, `web-bot-auth` and `http-message-sig` (F13 done).
- Probes: a throwaway test (created and deleted, not committed) confirmed R2, R3, R4 and R9 below.

## Summary

The package covers almost every point of issue #256 and follows the plan closely. The documents have the right
shape and are tested, the Web Bot Auth tests use an independent oracle (`web-bot-auth`, `http-message-sig`), the
DNS-AID wire cases are written by hand, and auth.md is checked against mcp-access's real metadata builder.
Nothing blocks a release. Eight findings should be fixed first:

- **Origins can drift (R1).** The `appOrigin` option can disagree with mcp-access's issuer, and the README asks
  for a setting mcp-access does not have. This is the same kind of drift issue §2 was written to prevent.
- **Unhandled errors (R2).** Origin resolution runs outside the handler's error wrapper, so a bad `Host` header
  throws out of the route.
- **Boot script syntax (R3).** One tool's line comment stops the WebMCP boot script from parsing.
- **Introspection cost (R4).** The MCP server is built twice for every request to an unknown skill name.
- **Plan items not done (R5–R7).** These were accepted in the plan triage: the `<link rel="ai-catalog">` helper
  (F12), UUID detection in `expectNoAccountData` (F16), and checking every verify marker against a real handler (F4).
- **Progress not recorded (R8).** `## Progress` is unticked and `change.md` still says `planned`.

## Findings

| ID | Severity | Where | Finding |
|---|---|---|---|
| R1 | should-fix | `src/options.ts:88-89`, `src/settings.ts:31`, `src/next/documents.ts:24-28`, `README.md:122` | `appOrigin` option can disagree with the issuer mcp-access computes |
| R2 | should-fix | `src/next/routes.ts:42-44` | Context resolution outside the `try`: bad `Host`, missing module or a bad resolver throw out of the handler |
| R3 | should-fix | `src/webmcp/index.ts:142` | Tool sources are concatenated unguarded; a trailing `//` comment breaks the whole boot script |
| R4 | should-fix | `src/next/routes.ts:94-101`, `src/next/documents.ts:42-48` | Unknown skill name builds the MCP server twice and calls the issuer before answering 404 |
| R5 | should-fix | `src/ai-catalog.ts`, `src/index.ts`, `README.md` | `buildAiCatalogLink` (F12 triage, issue §4.9) is missing |
| R6 | should-fix | `src/testing/index.ts:122-126` | `expectNoAccountData` lacks the default UUID detection accepted in F16 |
| R7 | should-fix | `tests/verify.test.ts:438-440`, `src/verify.ts:83,108,117,120` | mcp-access routes in the verify manifest are never checked against a real response; root PRM marker is weak on a single host |
| R8 | should-fix | `plan.md:215-224`, `change.md:4` | Progress unticked, no SHAs, status `planned` |
| R9 | nit | `src/options.ts:207-229` | Default MCP skill name can be invalid (`…a--mcp`) and is accepted |
| R10 | nit | `src/link-header.ts:24`, `src/api-catalog.ts:37-38`, `src/ai-catalog.ts:67`, `src/next/routes.ts:59,79,85` | Advertised media types differ from the served `content-type` |
| R11 | nit | `src/options.ts:170-175` | `catalog.queries` keys are not checked against the entry ids |
| R12 | nit | `src/auth-md.ts:77-78,120,122,129` | auth.md states mcp-access behaviour that the metadata does not say |
| R13 | nit | `src/mcp-skill.ts:52-53` | Empty code spans when the metadata lacks an endpoint |
| R14 | nit | `src/server/introspect.ts:97-102` | An anonymous server with no tools turns every card, skill and the AI catalog into 500 |
| R15 | nit | `src/cli/run.ts:152,160` | `check`: no skills is a FAIL; directory authority ignores redirects |
| R16 | nit | `src/next/routes.ts:118`, `src/server/web-bot-auth.ts:255` | Directory `@authority` keeps an explicit default port from `Host` |
| R17 | nit | `src/server/web-bot-auth.ts:202` | The key is re-parsed and a malformed one logged on every outgoing request |
| R18 | nit | several | Small drifts from the plan's wording and weak assertions |
| R19 | nit | `src/agent-skills.ts:38`, `src/http.ts:10`, `src/auth-md.ts:22`, `src/verify.ts:49` | Exported or shared function names that are not verbs |
| R20 | nit | `src/a2a-card.ts:20` | A2A `protocolVersion` holds the MCP version without a stated reason |

### R1 (should-fix): the `appOrigin` option can disagree with mcp-access's issuer

Trace: `resolveDocumentContext` takes `resolveAppOrigin(request)`, then `options.appOrigin`, then `config.appOrigin`
(`settings.ts:31`). mcp-access has **no** `appOrigin` option. It uses its own `resolveAppOrigin`, else
`config.appOrigin` (`mcp-access/src/server/origins.ts:12-18`). `createIssuerRequest` (F1 fix) only helps when
mcp-access resolves the origin from the request.

Scenario: `config.appOrigin = https://example.com` (the apex, because seo, blog and mail use it), with
`agentReady({ appOrigin: "https://app.example.com" })` and mcp-access without `resolveAppOrigin`:

- mcp-access sets the `issuer`, the path PRM `resource` and the 401's `resource_metadata` on the apex;
- agent-ready puts OpenAPI `servers`, the card endpoints and auth.md's `resource=` value on `app.example.com`.

An agent that follows auth.md sends `resource=https://app.example.com/api/mcp` and gets `invalid_target`. That is
issue §2's "consent page and routes disagreed". The README (`:122`) asks to "Configure `appOrigin` and
`resolveAppOrigin` the same way in both modules", which cannot be done because mcp-access has no `appOrigin`. No test
covers this: `tests/next.test.ts` always uses `appOrigin` = `config.appOrigin`.

Fix:

- In `readIssuerMetadata`, compare `new URL(metadata.issuer).origin` with `context.origins.appOrigin`. If they
  differ, throw `@softure-ai/agent-ready: the issuer's metadata names <issuer>, the documents <appOrigin>: …`. That
  gives a logged 500 instead of documents that disagree.
- Rewrite the README line: the `appOrigin` option must equal `config.appOrigin` unless mcp-access resolves the app
  origin per request. Or drop the option.
- Add a test with the mismatch.

### R2 (should-fix): context resolution runs outside the handler's `try`

`serve()` calls `getDocumentContext(getSoftureConfig(), request)` before `try` (`routes.ts:43`). Three kinds of
failure escape the handler:

- `getSoftureConfig()` or `getAgentReadyOptions` throwing;
- a resolver bug (`settings.ts:29`);
- a malformed `Host` header. `readRequestOrigin` calls `new URL("https://bad host")`. The probe confirmed that
  `serveApiCatalog` rejects with `Invalid URL`.

Next then logs a stack trace and answers with its own 500. The doc comment on `serve` (`:38-41`) promises "a 500
that names nothing internal", and AGENTS.md wants every failure handled or deliberately propagated. The test
`next.test.ts:195-198` pins the throw.

Fix: move the context call inside `try`, keep the named log, and change that test to expect
`500 {"error":"discovery_document_unavailable"}` plus the logged message.

### R3 (should-fix): a tool's line comment breaks the WebMCP boot script

`var X=[${executes.join(",\n")}];` (`webmcp/index.ts:142`) keeps `];` on the same line as the last source.

Probe: `execute: "(a, h) => h.ok('x') // trailing comment"` produces `SyntaxError: Unexpected identifier 'C'`. A parse
error is outside every runtime `try`, so no tool registers on any page and the only sign is a console error. A source
that is a statement rather than an expression breaks the script the same way.

Fix: emit each source as `(\n${src}\n)`. Optionally syntax-check each one at build time with
`new Function("return (" + src + "\n)")`, which runs in Node and throws by tool name. Add a test with a trailing
comment.

### R4 (should-fix): an unknown skill name costs a full introspection

`serveAgentSkill` renders every skill, including the generated MCP skill, before `findAgentSkill` (`routes.ts:97`).
For `/.well-known/agent-skills/<anything>/SKILL.md`, the handler:

- builds the app's MCP server twice (`initialize` and `tools/list`; the probe counted 2 builds);
- calls the issuer provider;
- only then answers 404 (`no-store`, so nothing is cached).

The route is public and has no rate limit. The SOFTURE conventions require rate limits and input validation on
public endpoints.

Fix: validate `name` against `options.skills[].name` and `getMcpSkillName(context)` first and answer 404
immediately. Introspect only when the MCP skill itself is requested (an app skill needs no server).

### R5 (should-fix): `buildAiCatalogLink` was accepted (F12) and is missing

Issue §4.9 asks for a `<link rel="ai-catalog">` helper, and the F12 triage says "`buildAgentmapDirective` and
`buildAiCatalogLink`". Only the first exists (searching `src/` finds no `AiCatalogLink`).

Fix: add `buildAiCatalogLink(apexOrigin)`, which returns `{ rel: "ai-catalog", href: "<apex>/.well-known/ai-catalog.json",
type: "application/json" }` for Next `metadata.other` or a `<link>`. Export it, test it, and add one README line.

### R6 (should-fix): `expectNoAccountData` checks only values the test already knows

F16 was accepted as written: "any UUID except the zero UUID, plus app-supplied values". The guard
(`testing/index.ts:122-126`) checks only `values`.

Scenario: the app's "anonymous" factory is accidentally built with a real `userId`, and a tool description
interpolates it. The guard passes because the test author did not list that id.

Fix: by default also reject any RFC 4122 UUID other than `00000000-0000-0000-0000-000000000000`, with an
`allow: string[]` opt-out. Add a test with a nested UUID.

### R7 (should-fix): verify markers for mcp-access routes are never checked against a real handler

The test `passes against the real handlers` skips every path without an agent-ready handler
(`tests/verify.test.ts:439-440`). That leaves these routes untested:

- `POST /api/mcp` 401 with `resource_metadata=`;
- `/.well-known/oauth-authorization-server`, whose markers are the quoted `jwks_uri` and `agent_auth.skill`;
- both PRM variants;
- `/` with `modelContext`.

F4's triage required "Unit-test every emitted marker against the handler's real response". Separately, in
single-host mode the root PRM marker `"https://example.com"` (`verify.ts:83`) is already satisfied by
`authorization_servers: ["https://example.com"]` even if `resource` were wrong.

Fix:

- Register a config with both `agentReady` and `mcpAccess` in the test. Run mcp-access's
  `getAuthorizationServerMetadataRoute` and the PRM route handlers, plus its MCP handler for the 401.
- Use a compact-serialization marker `"resource":"<apex>"` for documents mcp-access serves. mcp-access always
  answers with compact `Response.json`, so the F4c concern about pretty JSON does not apply to these documents.

### R8 (should-fix): Progress is not recorded

`plan.md` `## Progress` has eight unticked phases and no SHAs, and `change.md` says `status: planned`. All the work
landed in one commit (`cda3865`), not one commit per phase as the workflow requires.

Fix: tick the phases with `cda3865` (noting they landed together) and move the status forward, so impl-review and
archive can rely on Progress.

### R9 (nit): the default MCP skill name can be invalid

`getDefaultMcpSkillName("com.example/" + "a".repeat(59) + "_b")` returns `aaa…a--mcp` (the probe printed
`valid=false`). `slice(0, 60)` can end in `-`, and nothing validates the generated name. `agentReady()` accepted it.

Fix: strip trailing hyphens after `slice`, and in `superRefine` check the effective MCP skill name against
`SKILL_NAME_PATTERN`.

### R10 (nit): advertised media types differ from the served `content-type`

| Document | Advertised as | Served as |
|---|---|---|
| `/openapi.json` | `application/openapi+json` (Link header, API catalog) | `application/json` |
| Server card | `application/mcp-server-card+json` (API catalog, AI catalog) | `application/json` |
| A2A agent card | `application/a2a-agent-card+json` (AI catalog) | `application/json` |

A client that compares the two sees a mismatch. Fix: either serve the advertised types, or keep `application/json`
deliberately and say so in a comment and the README; a test can pin the pair.

### R11 (nit): `catalog.queries` keys are not checked

A typo (`api_catalog`), a key for a disabled A2A entry, or one for an unknown skill is silently ignored, and the
generic default queries go out instead (`options.ts:173`). Fix: in `superRefine`, require every key to be in
{`mcp`, `api-catalog`, `a2a` when enabled, skill names, the MCP skill name}.

### R12 (nit): auth.md states issuer behaviour that is not in the metadata

The following hold for mcp-access only:

- the registration response is `201`;
- redirect URI rules (`https`, `http` on loopback, native schemes, exact match);
- reusing a refresh token revokes the grant;
- `invalid_target`;
- "writes enabled for this service".

The module says it works with any issuer that supplies RFC 8414 metadata. Fix: state in the README and the
`buildAuthMd` doc comment that the prose assumes mcp-access, or tie each sentence to a metadata key.

### R13 (nit): empty code spans in the MCP skill

When the metadata lacks `authorization_endpoint` or `token_endpoint`, `mcp-skill.ts:52-53` prints `` ` ` `` and
`POST ` with no URL. Fix: leave the line out when the value is null.

### R14 (nit): a server with no anonymous tools loses every discovery document

A server that registers no tools answers `tools/list` with "Method not found". `readServerDescription` then throws
(`introspect.test.ts:281` pins this), and the server card, the A2A card, the skills index, every skill and the AI
catalog answer 500. Fix: treat JSON-RPC `-32601` on `tools/list` as an empty list, or document that the anonymous
server must list at least one tool.

### R15 (nit): two gaps in `agent-ready check`

- An empty skills index is a FAIL (`run.ts:152`) even for an app that publishes no skills on purpose
  (`mcpSkill: false`, no `skills`).
- `getAuthority(origin)` (`:160`) ignores redirects. If `example.com` redirects to `www.example.com`, the signature
  is checked against the wrong authority. Use `new URL(response.url).host` when it is set.

### R16 (nit): the directory `@authority` can keep a default port

`readRequestHost` returns `Host` as sent. `Host: example.com:443` is signed as `example.com:443`, but RFC 9421 §2.2.3
leaves out a default port, so verifiers fail. Fix: normalize through `new URL(\`${proto}://${host}\`).host`.

### R17 (nit): the key is re-parsed on every outgoing request

`signOutgoingRequest` reads and parses the seed (`createPrivateKey`) on every call. A malformed seed is logged on
every outgoing request. Fix: resolve the key lazily once per `createSignedFetch`.

### R18 (nit): drifts from the plan and weak assertions

- The plan names `verifyManifest`; the code is `buildVerifyManifest`. The code name is better; update the plan.
- F5 says "No environment reads in the module", but `serveSignatureDirectory` reads `process.env`
  (`routes.ts:115`). This follows the issue's env-name design; record it in the plan.
- F14 asked for a test that `getResourceMetadataUrl` equals mcp-access's `getProtectedResourceMetadataUrl`.
  `oauth.test.ts:333` compares it with a literal string instead.
- `introspect.test.ts:276-280`, "throws by name", asserts `.rejects.toThrow()` without a message.
- The OpenAPI pin (`documents.test.ts:116-120`) passes again if someone updates only the digest. A
  `{ version: digest }` history table would make a missing bump fail.

### R19 (nit): function names that are not verbs

Conventions ask for verb-first function names. Rename before the first publish freezes the API: exported
`frontmatter` → `buildFrontmatter`, exported `prettyJson` → `formatJson`, and the internal `code` and `quoted`.

### R20 (nit): A2A interface `protocolVersion`

`supportedInterfaces[0].protocolVersion` holds the MCP date version. A2A 1.0 defines it as the protocol version of
the interface's binding, so with `MCP` as the binding it is defensible. State the choice in the file's comment.

## Coverage against the issue and the plan

| Item | State |
|---|---|
| Origin resolver per request, never `request.url` | Done; see R1 and R2 |
| API catalog | Done |
| OpenAPI 3.1 and contract pin | Done |
| Home page `Link` header and `nextHeaders` | Done |
| OAuth extension adapter (F3) and the JWKS | Done |
| auth.md tied to mcp-access's metadata | Done |
| MCP server card and A2A card, introspected | Done |
| Agent Skills | Done |
| AI catalog | Done, except the `<link>` helper (R5) |
| Web Bot Auth with the oracle | Done |
| DNS-AID | Done |
| WebMCP | Done; see R3 |
| Guards | Done; F16 gap (R6) |
| Verify manifest per host | Done; test gap (R7) |
| CLI | Done |
| Architecture test (F8) | Done |
| README: twelve sections and the parity section (F18) | Done |
| CHANGELOG | `## 0.1.0` at version 0.1.0; allowed by `tests/repo/packages.test.ts`, though the plan said `## Unreleased` |
| Owner step (F20: `NPM_TOKEN`, scan in the adoption change) | Recorded in the plan; carry it into the archive notes |

No secret leaks were found: seeds are never logged, and the CLI refuses to print a key to a terminal. No account
data reaches the documents (no tool is called, and `instructions` from `initialize` is dropped). The boot script's
data is escaped (`<`, U+2028, U+2029); only the app-authored `execute` sources go in as written, and they are
screened for `</script` and `<!--`.

## Verdict

**Approve after fixes.** Nothing blocks. Fix R1–R8 before archiving and publishing 0.1.0, since R1, R2 and R4 change
runtime behaviour and R5–R7 close items the plan triage accepted. R9–R20 can go into the same pass or be recorded in
the change folder.

## Triage (2026-10-08)

| ID | Decision | Where |
|---|---|---|
| R1 | Fixed: an issuer on another origin than the app origin throws by name and the route answers 500; README says mcp-access takes the config's `appOrigin` | `src/next/documents.ts`, README §3, `next.test.ts` |
| R2 | Fixed: origin resolution runs inside the handler's `try`; own setup errors are logged by message | `src/next/routes.ts`, `next.test.ts` |
| R3 | Fixed: each `execute` source is wrapped in parentheses on lines of its own | `src/webmcp/index.ts`, `webmcp.test.ts` |
| R4 | Fixed: `serveAgentSkill` renders only the named skill and builds the server only for the MCP skill | `src/next/routes.ts`, `src/next/documents.ts` |
| R5 | Fixed: `buildAiCatalogLink()` | `src/ai-catalog.ts`, README §4 |
| R6 | Fixed: `expectNoAccountData` fails on any UUID unless `allowedUuids` lists it | `src/testing/index.ts` |
| R7 | Fixed: the issuer's routes (POST 401, AS metadata, both PRM variants) are checked against mcp-access's real handlers; PRM markers carry the `resource` key | `src/verify.ts`, `verify.test.ts` |
| R8 | Fixed: Progress ticked with the SHAs, `change.md` status updated | `plan.md`, `change.md` |
| R9 | Fixed: the default name is cut before trimming dashes, and an invalid generated name is refused | `src/options.ts` |
| R10 | Kept: the documents are served as `application/json`, which scanners and the reference expected; the advertised types name the document kind | none |
| R11 | Fixed: `catalog.queries` keys are checked against the entry ids | `src/options.ts` |
| R12 | Kept: the README states that auth.md describes an mcp-access issuer; another issuer passes its own metadata and the endpoint list follows it | README §3 |
| R13 | Kept: the MCP skill is built only with metadata that mcp-access generates in full | none |
| R14 | Fixed: a server without the tools capability lists no tools | `src/server/introspect.ts` |
| R15 | Kept: a published skills index with no skills is a misconfiguration worth failing; `check` takes the URL the verifier fetches | none |
| R16 | Fixed: the directory's `@authority` drops the default port | `src/next/routes.ts` |
| R17 | Kept: signing reads the environment per request so a rotated key needs no restart; follow-up if it shows in profiles | none |
| R18 | Partly: `buildVerifyManifest` is the name in the plan's sense; the OpenAPI pin stays as written | none |
| R19 | Fixed: `buildFrontmatter`, `formatJson`; private helpers stay | `src/agent-skills.ts`, `src/http.ts` |
| R20 | Kept: A2A 1.0 leaves `protocolVersion` to the binding; for `MCP` it is the MCP version | none |
