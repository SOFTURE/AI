# Plan review: agent-ready-package

- Date: 2026-10-08
- Inputs: `change.md`, `research.md`, `plan.md` (this folder); issue #256 body; `modules/mcp-access` (`src/options.ts`,
  `src/origins.ts`, `src/server/origins.ts`, `src/server/oauth-http.ts`, `src/client-setup.ts`); `modules/seo`;
  `tools/deploy/src/verify/schema.ts`; `docs/02-module-standard.md`; `tests/repo/packages.test.ts`;
  `scripts/release/release-rules.mjs`; `eslint.config.mjs`; the current `modules/agent-ready` scaffold; the reference
  implementation (builders, routes, tests).
- Verdict up front: the decomposition is sound and covers most of the issue, but the OAuth hand-off to mcp-access has
  contract gaps that would reproduce exactly the bugs the issue's §2 was written against. Fix F1–F4 before Phase 2.

## Findings

### Blocking

**F1. Two origin resolvers, no agreement rule (issue §2, "consent page and routes disagreed").**
Evidence: plan.md:61-66 resolves `appOrigin` as `options.appOrigin ?? config.appOrigin`; mcp-access resolves it with
`resolveAppOrigin(request)` else `config.appOrigin` (`mcp-access/src/server/origins.ts:60-66`). The AS metadata and
`auth.md` (plan.md:72-75) are built by mcp-access's resolver, the cards/catalog/OpenAPI by agent-ready's. An app that
sets `resolveAppOrigin: readRequestOrigin` (the documented choice for an image built once) gets `issuer` = apex when
the AS document or `auth.md` is requested on the apex, while agent-ready keeps app URLs: the documents disagree.
Fix: decide one source. Recommended: agent-ready's `appOrigin` defaults to mcp-access's resolution when mcp-access is
configured (read `resolveMcpOrigins` through the AS provider, or require the app to pass the same function to both),
and the README states the required mcp-access settings for two hosts (`resolveAppOrigin` must never return the apex).
Add an origin-matrix case that asserts `issuer` in the AS document equals `appOrigin` in the server card on both hosts.

**F2. Root PRM `resource` = apex needs `resourceOrigins`, and nothing in the plan says so or tests it.**
Evidence: mcp-access answers the root PRM with the request host only when that host is in `resourceOrigins`, else
with the issuer (`oauth-http.ts:129-158`, `origins.ts:43-48`). The issue requires root PRM `resource` = requestOrigin
(§2, §4.4) and a verify check "root PRM resource = apex" (§5). The reference returns the request host unconditionally.
The plan's origin matrix (plan.md:153-154) runs only agent-ready's handlers.
Fix: document `resourceOrigins: [apexOrigin]` as a requirement in README §3/§4; make `expectOriginMatrix` accept the
app's PRM handlers (root and path variant) and assert root `resource` = requestOrigin for apex and app `Host`.

**F3. `buildAgentAuthMetadata` cannot be plugged into mcp-access as specified.**
Evidence: the extension hook receives `McpOrigins = { appOrigin, resourceOrigins }`, no apex and no routes
(`mcp-access/src/options.ts:54`, `origins.ts:10-15`); plan.md:68-70 builds `agent_auth.skill` = `<apex>/auth.md` and
`register_uri` from `{ appOrigin, apexOrigin, registrationEndpoint }`. Inside the extension the apex and the
registration path are unknown, so either they are hard-coded (drift from `getMcpAccessRoutes`) or the extension
cannot be a function.
Fix: export an adapter `agentAuthMetadataExtension(settings)` that returns `(origins: McpOrigins) => {...}` with the
apex from configuration (fallback `origins.appOrigin`) and the registration path passed in from mcp-access's routes;
the Phase 2 parity test asserts `agent_auth.register_uri === registration_endpoint` and `jwks_uri` host = issuer host.
Note that generated keys win (`oauth-http.ts:105-107`), so the extension must never try to set `issuer` or endpoints.

**F4. The verify manifest cannot express several required checks as planned.**
Evidence: deploy verify checks one URL per run, `contains` body markers and one substring per header name
(`tools/deploy/src/verify/schema.ts:20-27, 40-66, 93`). (a) The 4 Link rels on `/` are one `link` header: one entry
checks one substring. (b) The documents live on two hosts (apex: catalogs, cards, root PRM; app: `401` with
`resource_metadata`, path PRM, JWKS), but plan.md:100 returns routes "for one host". (c) Markers in the issue's
`"key": "value"` form match agent-ready's pretty JSON but not mcp-access's compact `Response.json` output
(`oauth-http.ts:150-153`), so "`agent_auth.skill`" and "root PRM resource = apex" markers would never match.
(d) Digests and the directory signature move to `agent-ready check <url>`, which nothing runs after a deploy.
Fix: `verifyManifest({ host: "apex" | "app" })` returning one route list per host (README shows two verify runs);
one `/` route per Link rel; markers built per document from its real serialization (compact for mcp-access); and
the README tells the app to run `agent-ready check` in the same release step. Unit-test every emitted marker against
the handler's real response.

### Should-fix

**F5. The options schema is never written down.** plan.md:57-60 and Phase 1 name `options.ts` but not its keys.
Issue §3 lists `name`, `title`, `description`, `provider`, `mcp { path, server, protocolVersions }`, `oauth`,
`serviceDoc`, `openapi`, `skills`, `catalog`, `a2a { enabled, skillTags }`, `webBotAuth`, `dnsAid`, `messages`, and
env fallbacks `APP_ORIGIN` / `APP_PUBLIC_ORIGIN`. The plan drops `protocolVersions` (takes one `protocolVersion`,
plan.md:76), `skillTags`, `messages` and the `APP_PUBLIC_ORIGIN` fallback without saying so. Fix: add the schema
(key, type, default, which document reads it) to Key decisions, and record each deliberate deviation.

**F6. OpenAPI, server card and MCP skill take OAuth URLs and scopes from an unnamed source.** Issue §4.2 wants
`oauth2` authorizationCode URLs on the app host with config scopes; plan.md:72-75 gives only `auth.md` a metadata
provider. Fix: every document that names an OAuth URL or scope reads the same AS metadata provider; without `oauth`,
OpenAPI ships `bearerAuth` only and the card's `authentication.scopes` come from the scope constants.

**F7. OpenAPI version bump guard is missing.** Issue §4.2: "the contract test fails when the envelope changes without
a bump". Phase 1 tests only shape and `$ref`s. Fix: pin a hash of the envelope (paths + schemas) next to
`openapi.version` in a test; a change without a version bump fails.

**F8. No guard for the entry-point constraints (issue §6, change.md constraints).** eslint restricts `next/*` only in
`src/server`, `src/ui`, `src/pages`, `src/discovery` (`eslint.config.mjs:37-44`); nothing stops the root entry or
`nextHeaders` from importing `@softure-ai/core/next`, and nothing stops `./webmcp` from importing `node:*` or the root
(which pulls `node:crypto` via `digestOf`). plan.md:150-152 also places `nextHeaders` in `./next`, the entry that reads
`getSoftureConfig()`, which is not registered while `next.config.ts` loads. Fix: `nextHeaders` takes options and lives
in the root (or `./next` keeps it free of the registry); add a repo or package test that walks the import graph of
`src/index.ts` (no `@softure-ai/core/next`, no `next/*`, no database) and of `src/webmcp/index.ts` (no `node:*`, no
non-webmcp module), and an eslint block for `src/webmcp/**` banning `node:*`.

**F9. Phases 2-7 have no done-when criteria.** Only Phase 1 and 8 have one (plan.md:113, 159). Fix: per phase,
"package tests green, typecheck and lint green, commit SHA in Progress", plus each phase's acceptance item (e.g. Phase 3:
"adding a tool to the test server changes both cards" = acceptance 4; Phase 5: acceptance 3).

**F10. `dynamic` cannot be shipped as an export.** plan.md:154 tests a "dynamic export"; Next reads route segment
config only as a literal in the app's route file. Fix: follow the mcp-access and blog README precedent (the app
writes `export const dynamic = "force-dynamic"`), and drop the export test; the handlers read the request anyway.

**F11. Pretty-printing and cache headers are not in the plan.** Issue §4: 2-space JSON, `max-age=3600` (300 for
skills and AI catalog), CORS `*`. Phase 8 tests "cache and CORS headers" without the values. Also mcp-access serves its
discovery documents with `max-age=300` and a `vary` header. Fix: state the values and that the mcp-access documents
keep theirs (and F4c's markers follow).

**F12. AI catalog gaps.** Issue §4.9: the `Agentmap:` robots line via seo `robots.other` and the
`<link rel="ai-catalog">` helper are not planned; "exactly one of `url` or `data`" is not a listed test. The default
queries "built from the title and description" (plan.md:85-86) put product wording in the package, which §1 rules out.
Fix: add the two helpers and the test; require `catalog.queries` for every entry (validation error naming the entry)
instead of generating them.

**F13. Lockfile and scaffold.** `modules/agent-ready` already exists with a template `src/index.ts`
(`MODULE_ID = "template-module"`) and `web-bot-auth` in devDependencies, but `package-lock.json` has neither the
workspace nor `web-bot-auth`, and `node_modules/@softure-ai/agent-ready` is missing. `npm ci` (CI, hooks) fails on
the mismatch. Fix: Phase 1 runs `npm install`, commits the lockfile, and replaces every template placeholder.

### Suggestions

**F14.** `getResourceMetadataUrl` (plan.md:71) duplicates mcp-access `getProtectedResourceMetadataUrl`; re-export or
delegate, or test they agree.
**F15.** `findAppRoute` must handle route groups `(x)`, dynamic segments `[name]` and dotted folders (`.well-known`,
`openapi.json`); give the guard a negative case per kind (issue §5 asks for one).
**F16.** `expectNoAccountData` needs a definition of "account id" (any UUID except the zero UUID, plus app-supplied
values); the plan should state who builds the anonymous context (the app's factory) and that the guard runs on the
card output.
**F17.** auth.md lifetimes: read them from mcp-access options (`accessTokenLifetimeMinutes`,
`refreshTokenLifetimeDays`) through the same provider, and state that "Revocation" describes the token page, since
mcp-access has no RFC 7009 endpoint.
**F18.** README: the twelve sections must be the only `## N. ` headings (`packages.test.ts:144-150`); put "Parity
with the reference implementation" as an unnumbered `##` or under §12. Mention seo's `fetchImpl` for `signedFetch`.
**F19.** `agent-ready check <url>` and `pathPatterns` are beyond the issue; fine, but record them as decisions.
**F20.** Record the owner step for the first publish (`NPM_TOKEN`, change.md constraints) in the plan, so it is not
lost at archive time; acceptance 2 (scanner) is deferred to the adoption change — say so in the archive notes too.

## Coverage check (issue §4-§7)

Covered: §2 resolver; §4.1 (except opt-in `status`, add a line), §4.3, §4.6, §4.7 (except `skillTags`), §4.8, §4.10,
§4.11, §4.12 (signature extended, acceptable), §4.13 (deferred to mcp-access, as the issue prefers); §5 guards (gaps
F2, F4, F15, F16); §6 entry points (gap F8); §7.1 (gap F1/F2), §7.3, §7.4, §7.5, §7.6. §4.4 and §4.5 depend on F1-F3.

## Verdict

Revise before implementing: fix F1-F4 (blocking) and F5-F13 in plan.md, then proceed.

## Triage (2026-10-08)

Every finding accepted; plan.md gained "Decisions after review" with the fix of each.

| Finding | Decision |
| --- | --- |
| F1 | Accepted. agent-ready resolves the origins once; the AS metadata provider gets a request rebuilt on the resolved app origin (`Host` + `X-Forwarded-Proto`), so mcp-access's issuer equals the card endpoint whatever `resolveAppOrigin` does. Test with mcp-access's real builder on apex and app hosts. |
| F2 | Accepted. README: list the apex in mcp-access `resourceOrigins`; the origin-matrix test runs mcp-access's root PRM handler on the apex. |
| F3 | Accepted. `createAgentAuthExtension({ apexOrigin, registerPath, serviceDocPath })` returns the `(origins) => keys` function mcp-access takes; parity test `register_uri === registration_endpoint`. |
| F4 | Accepted. `verifyManifest({ host })` per host, one route per Link rel, markers are quoted values (match compact and pretty JSON); digests and the directory signature run as `agent-ready check <url>`, a documented post-deploy step. |
| F5–F7, F9, F11 | Accepted: options, sources of OAuth URLs, the OpenAPI contract test, done-when per phase and header values written in the plan. |
| F8 | Accepted: an architecture test keeps `next/*`, `@softure-ai/core/next` and databases out of the root entry and every Node built-in out of `./webmcp`; `nextHeaders` is exported from the root too. |
| F10 | Accepted: README tells apps to write `export const dynamic = "force-dynamic"` in each route file. |
| F12 | Accepted: `buildAgentmapDirective` and `buildAiCatalogLink`; default queries stay as a fallback and the README says to pass the app's own. |
| F13 | Accepted: `npm install` updates the lockfile in phase 1; template placeholders replaced. |
| F14–F20 | Accepted as written (F14: kept, the issue names it; a test checks it equals mcp-access's). |
