# Research: agent-ready-package

Sources read: the reference implementation named in issue #256 (builders, routes, scripts and tests listed in its §8),
`modules/mcp-access` (OAuth layer after #234), `modules/seo` (a module without a database and with machine-format
output), `tools/deploy` (`verify` schema and bin layout), `docs/02-module-standard.md`, `tests/repo/packages.test.ts`
and `templates/package/`.

## Findings

1. **OAuth discovery already lives in mcp-access, with per-request origins.** Since 0.1.8 (#234) mcp-access serves
   `/.well-known/oauth-authorization-server` and both protected resource metadata variants, builds every URL from
   `resolveMcpOrigins(config, request)` (`resolveAppOrigin` + `resourceOrigins`), answers the root variant with the
   host it was asked on when that host is a resource origin (RFC 9728 §3.3), and merges app keys through
   `oauth.metadata.authorizationServer` / `.protectedResource` (a static object or a function of the origins).
   What the reference app adds on top: `jwks_uri` (an empty JWKS, opaque tokens), `service_documentation`, `agent_auth`
   (`skill` = `<apex>/auth.md`, `register_uri`) and `resource_documentation`. All four fit the extension hook. The
   issue's §1 choice is therefore settled without moving code: mcp-access keeps the OAuth documents; agent-ready
   builds the extension keys, serves the JWKS and builds `auth.md` from the metadata mcp-access generates.
2. **Markdown negotiation (#249)** is in progress in `seo`. agent-ready only adds the optional `describedby` link.
3. **MCP client setup (§4.13)** exists in mcp-access (`getMcpClientSetup`); the issue prefers it. Not duplicated.
4. **The reference builders** hard-code product text, paths and the origin helper (six copies of the trailing-slash
   trim). Everything else is generic: the documents depend only on origins, paths, names, scopes, the introspected
   `initialize` + `tools/list` result and app-supplied skills and queries.
5. **Introspection** in the reference app uses `createMcpHandler(factory, { responseMode: "json" })` from
   `@modelcontextprotocol/server` (2.3.0 at the repo root; mcp-access takes `^2.0.0` as a peer). 2025-era requests
   still get SSE, so the reader takes the last `data:` line.
6. **Web Bot Auth** is pure `node:crypto` (Ed25519 seed → PKCS#8 with the fixed DER prefix, RFC 7638 thumbprint). The
   reference tests verify signatures with `web-bot-auth` 0.2.0 (npm) and the RFC 9421 B.1.4 key; the same oracle is
   available as a dev dependency.
7. **DNS-AID** is pure parsing and evaluation plus a DoH CLI; the record list is the only app-specific part.
8. **WebMCP**: the reference boot script mixes a generic runtime (feature detection, path allow-list, double
   registration flag, `<` escaping, try/catch, markdown fetch) with product tools. The generic part takes tools whose
   `execute` is JavaScript source, since an inline `<head>` script cannot import a bundle.
9. **deploy verify** checks status, body markers and header substrings per route, one value per header name; it
   cannot recompute digests or verify a signature. Those two need code: an `agent-ready check <url>` command.
10. **Module shape**: a module without a database (`dbSchema: null`) like seo, empty `pl`/`en` dictionaries (machine
    formats, the seo precedent), twelve README sections, `module.json` equal to `toModuleJson`, and a `bin` like
    deploy's. `next.config.ts` and `proxy.ts` load the root entry, so the root must not import `@softure-ai/core/next`
    or a database.
