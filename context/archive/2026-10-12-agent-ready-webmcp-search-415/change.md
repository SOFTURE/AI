---
change_id: agent-ready-webmcp-search-415
title: "agent-ready: ready-made WebMCP site search and glossary tools (issue #415)"
status: archived
roadmap_item: null
issue: 415
branch: claude/project-thread-22aulm
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

Close [issue #415](https://github.com/SOFTURE/AI/issues/415) (labels `enhancement`, `adoption`, `pkg: mcp-access`,
`pkg: agent-ready`). An adopting app registers two browser-side WebMCP tools without writing them:

1. `searchSite(query)`: searches the Markdown versions (seo's `Accept: text/markdown`) of the site's public pages,
   listed by the sitemap (seo's `/sitemap.xml`) or by the app, and answers the best pages with a snippet.
2. `findTerm(term)`: finds a term in the blog glossary (the glossary index's `DefinedTermSet`) and answers its
   definition from the term's page.

Both come from `@softure-ai/agent-ready/webmcp` as `WebMcpTool`s for `registerWebMcpTool`. A reviewer checks
`modules/agent-ready/tests/webmcp-search.test.ts`, the blog contract test, the README and the CHANGELOG `Unreleased`.

## Context

> 1. **Catalog guard** (mcp-access): the human-readable tools catalog shown on the token screen must list exactly the
>    tools the server registers (name, read/write). [...] Proposed: `@softure-ai/mcp-access/testing`
>    `expectCatalogMatchesServer({ createServer, catalog })`, or derive the catalog from the registry.
> 2. **WebMCP search tools** (agent-ready): browser-side `searchSite(query)` over the page markdown of public pages and
>    `findTerm(term)` over a glossary. Proposed: prebuilt tools in `@softure-ai/agent-ready/webmcp`, fed by the seo
>    markdown pages and the blog glossary.

Point 1 is already done: `expectToolCatalogMatchesServer(config, createServer)` in `@softure-ai/mcp-access/testing`
(#386, released in mcp-access 0.1.14); verified on master and ticked off in the issue. This change covers point 2.
agent-ready is at 0.1.3 on master; releases are batched by the coordinator, so no version bump.

## Constraints

- The `/webmcp` entry stays free of every import (architecture test): browser only, no zod, no Node.
- Existing WebMCP exports keep their API and behaviour.
- Owns `modules/agent-ready/src/webmcp/`, its README section and CHANGELOG; a contract test and a devDependency in
  `modules/blog`.

## Notes

- Placement: unlinked (issue work, `autonomy.source: issues`).
- Framing: skipped. The issue names the tools, their sources and the entry.

## Decisions (auto)

- Point 1 is not reworked: the shipped `expectToolCatalogMatchesServer(config, createServer)` reads the catalog from
  the config, which is the issue's first proposal in another signature.
- No version bump; `## Unreleased` in the CHANGELOG (batched releases).
- Factories `createSearchSiteTool(options)` and `createFindTermTool(options)` returning `WebMcpTool`, rather than
  boot-script variants: a boot script's tools are source text and would duplicate the logic. A page without a client
  component registers them from a small one.
- Pages come from the sitemap by default (`/sitemap.xml`), each `<loc>` taken as a path on the page's own origin, so a
  canonical origin that differs from the serving one (www, preview) still searches this site.
- The glossary is read from the index page's JSON-LD (`DefinedTermSet.hasDefinedTerm`: name, description, url), a
  structured contract, not from its Markdown layout.
- Default tool names follow the issue: `searchSite`, `findTerm`.
