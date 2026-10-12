---
change_id: agent-ready-webmcp-search-415
status: archived
---

# Plan: agent-ready WebMCP site search and glossary tools (issue #415)

Input: change.md, research.md. Complexity: small (two factories in one import-free file, tests, docs).

## Phase 1: the two tools (TDD)

Files: `modules/agent-ready/src/webmcp/index.ts`; test `modules/agent-ready/tests/webmcp-search.test.ts`.

1. Tests first (happy-dom, a fake `fetch`):
   - `createSearchSiteTool()` reads `/sitemap.xml`, fetches each `<loc>` path as Markdown, ranks pages by matched
     query words (all words first, title matches above body ones), answers title, path and a snippet; folds case and
     Polish diacritics (`zloty` finds the word spelled with U+0142); `limit` caps the list; no match answers a plain "no page" text;
     a page that fails is skipped; every page failing, or the sitemap failing, is an error result; an empty or
     non-string `query` is an error result; `pages: { paths }` skips the sitemap; `maxPages` caps the fetches and the
     answer says how many pages were searched; Markdown is fetched once per tool across calls.
   - `createFindTermTool()` reads the glossary page's JSON-LD terms, matches the term exactly (folded), then by URL
     slug, then a single partial match; answers the term page's Markdown under the term name, the description when
     that page fails; several partial matches list them; none answers "no term"; a glossary without terms says so; a
     glossary page failing is an error result.
   - Both have JSON Schema inputs and overridable `name`/`description`, and register through `registerWebMcpTool`.
2. Implement in `webmcp/index.ts`: `createSearchSiteTool`, `createFindTermTool`, their option types, and shared
   private helpers (fold, frontmatter title, sitemap paths, JSON-LD terms).

## Phase 2: blog contract and docs

- `modules/blog/tests/webmcp-glossary.test.ts`: `findTerm` over a page holding `buildGlossaryJsonLd(config, terms)`
  finds a term (devDependency `@softure-ai/agent-ready` in blog).
- `modules/agent-ready/README.md` (WebMCP paragraph), `modules/agent-ready/CHANGELOG.md` (`## Unreleased`),
  a line in `modules/blog/README.md` that the glossary JSON-LD feeds `findTerm`.

## Progress

- [x] Phase 1: the two tools (`d9ff2c9`; the new test file failed on master, missing exports; 20 tests green after)
- [x] Phase 2: blog contract and docs (`b78ca3a`)

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` green (6466 passed, 153 skipped).
