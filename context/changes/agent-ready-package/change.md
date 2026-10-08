---
change_id: agent-ready-package
title: "New package @softure-ai/agent-ready: agent discovery documents, Web Bot Auth, DNS-AID, WebMCP and their guards (issue #256)"
status: planned
roadmap_item: null
issue: 256
branch: claude/project-thread-ixjm5y
created: 2026-10-08
updated: 2026-10-08
---

## Intent

Ship `@softure-ai/agent-ready` 0.1.0, so an app publishes everything an AI agent uses to discover and connect to it
from configuration plus its MCP server, as specified in [issue #256](https://github.com/SOFTURE/AI/issues/256):

- an origin resolver per request for two hosts (apex and app), never `request.url`;
- the API catalog (RFC 9727), OpenAPI 3.1 of the MCP envelope, the home `Link` header (RFC 8288);
- OAuth discovery additions for MCP (`agent_auth`, `jwks_uri`, `service_documentation`, an empty JWKS) and `auth.md`
  built from the same authorization server metadata;
- the MCP server card (SEP-2127 and SEP-1649 in one document) and the A2A agent card, both introspected live from the
  app's MCP server;
- Agent Skills Discovery v0.2.0 (index with digests, `SKILL.md`, a generated `<app>-mcp` skill) and the AI catalog (ARD 1.0);
- Web Bot Auth (RFC 9421 request signing, signed key directory, key CLI) and DNS-AID (records, zone lines, DoH check CLI);
- the WebMCP browser runtime;
- guards in `./testing` and a `verify` manifest for `@softure-ai/deploy`.

A reviewer checks the package tests (origin matrix, oracle tests with the reference `web-bot-auth` library, card ↔
server parity, auth.md ↔ metadata parity), the README (twelve sections and the parity map), and that the package
imports from `proxy.ts` and `next.config.ts` work (no database, no aliases in the root entry).

## Context

Issue #256 (GitHub Issues mode, no roadmap item). The design comes from a production app that ships every piece and
passes the isitagentready.com Level 3 scan; that app adopts the package once it is released (a separate change in the
app). Related: `mcp-access` 0.1.8 already resolves OAuth URLs per request and accepts metadata extensions (#234), and
markdown content negotiation is #249.

## Constraints

- No database, no migrations; runtime deps `@softure-ai/core`, `zod`, `node:crypto`; the MCP SDK as a peer.
- The root entry and the `Link` header helper load from `next.config.ts` and `proxy.ts`: no path aliases, no database.
- `./webmcp` runs in the browser: no Node imports.
- A missing Web Bot Auth key is not an error; a malformed one is logged by variable name, never by value.
- English-only code and docs; neutral public wording.
- First publish needs an `NPM_TOKEN` from the owner (new package, no trusted publisher yet).

## Process notes

- Research: done (research.md): the reference sources, mcp-access's OAuth layer, seo, deploy's verify schema and the
  module standard.
- Framing: skipped. The issue is an approved specification with its scope and out-of-scope lists; the two open
  choices it names (OAuth discovery here or in mcp-access; markdown negotiation here or in seo) are settled in the plan
  from the code as it is today.
