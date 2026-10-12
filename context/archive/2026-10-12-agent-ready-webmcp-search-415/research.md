---
change_id: agent-ready-webmcp-search-415
---

# Research: agent-ready-webmcp-search-415

Sources: `modules/agent-ready/src/webmcp/index.ts`, `modules/agent-ready/tests/{webmcp,architecture}.test.ts`,
`modules/agent-ready/README.md`, `modules/seo/src/server/html-to-markdown.ts`, `modules/seo/README.md`,
`modules/blog/src/pages/json-ld.ts`, `modules/blog/src/next/json-ld.ts`, `modules/blog/src/ui/blog-glossary.tsx`,
`modules/mcp-access/src/testing/catalog.ts`.

- Point 1: `expectToolCatalogMatchesServer(config, createServer)` and `getToolCatalogDifferences` exist in
  `@softure-ai/mcp-access/testing` (commit `257ab93`, #386), tested in `adoption-gaps-315.test.ts`, documented in the
  README; mcp-access is 0.1.14 on master and npm. Nothing to build.
- `/webmcp` already has `WebMcpTool`, `textResult`, `errorResult`, `fetchMarkdown(path, fetchImpl)` (sends
  `Accept: text/markdown`, `credentials: "omit"`, strips the frontmatter) and `registerWebMcpTool`. The architecture
  test forbids every import in `webmcp/`, relative ones included (`readImports` matches `export ... from`), so new
  code goes into `webmcp/index.ts` itself and the input schemas are JSON Schema literals.
- seo's page Markdown starts with a frontmatter of JSON-quoted `title`, `description`, `url`, then the `main` element
  as Markdown. `fetchMarkdown` drops the frontmatter; the search needs the title, so it reads it before stripping.
- seo's `/sitemap.xml` lists every public page as absolute `<loc>` URLs on the canonical origin; the Markdown version
  exists for every sitemap page.
- blog's glossary index (`/blog/glossary` by default) carries one `DefinedTermSet` JSON-LD
  (`buildGlossaryJsonLd(config, terms)`, `@softure-ai/blog/next`) with `hasDefinedTerm[]` of
  `{ "@type": "DefinedTerm", "@id", name, description, url }`; it is `null` (no script) without terms. A term page
  has the full definition and is a sitemap page (Markdown available). The index's Markdown renders the `<dl>` as
  link and paragraph pairs, a layout detail, so the JSON-LD is the better source.
- Polish content: matching must fold case and diacritics (U+0142, the l with stroke, does not decompose under NFKD).
