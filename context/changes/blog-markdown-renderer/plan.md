# Plan: blog-markdown-renderer

Input: change.md, research.md. Complexity: medium (one new folder of pure functions, ported from a
tested FIRE renderer; the security boundary is the main risk).

## Goal

`renderArticle(markdown, options)` and its helpers exist in `modules/blog/src/render/`, exported from
`@softure-ai/blog/server`; FIRE's renderer, glossary and reading-time cases pass in the package in
English, plus XSS fixtures and a FIRE-like chart plugin fixture (HTML and node output).

**Out of scope:** pages, CSS and the TOC component (BL-4), quality rules over block needs (BL-6),
FIRE's chart engine (stays in FIRE), images (no hosting policy yet).

## Approach

**Chosen:** port FIRE's `blog-markdown.ts` and `blog-glossary.ts` into `src/render/` file by file,
replacing FIRE literals with options and message dictionaries, and FIRE's `::wykres{}` rule with a
generic fence plugin hook. Rejected: a remark/rehype pipeline with a sanitiser (research U1).

**Key decisions:**
| Decision | Choice | Why |
| --- | --- | --- |
| Parser | `markdown-it` ^15.0.2, `markdown-it-footnote` ^4.0.0, types as devDependencies | research U1 |
| Allowed links | `http:`, `https:`, `mailto:`, relative, `#`; everything else stays text | FIRE |
| External | `http(s)` or `//` to a host not in `siteHosts` (exact or subdomain) → `rel="noopener noreferrer" target="_blank" class="blog-external"`, a marker `<span class="blog-external-marker" aria-hidden="true">↗</span>` and a visually hidden "(opens in a new tab)" | roadmap: an external marker; FIRE's rule |
| Glossary href | `termHref(slug)`, default `/blog/glossary/<slug>`; a manual link counts as linked when it equals the href of a glossary term (query/hash/trailing slash ignored) | no FIRE path |
| Glossary input | `GlossaryTerm { slug, forms }`; `toGlossary(articles)` maps `kind = "term"` rows | BL-2 note |
| Block plugins | `blocks: readonly BlockPlugin[]`; `{ type, requires?, render(block) → { html } \| { node } }`; `block = { type, info, content, article }` | research U2, U3 |
| Fence | ```` ```<type> <info> ```` ; an unregistered type stays a code block | research U4 |
| Result | `{ html: string \| null, segments, headings, toc: string \| null, linkedTerms, readingMinutes }` | research U3 |
| TOC | `toc: true` (or `{ maxLevel }`, default 3) renders `<nav class="blog-toc" aria-label=…>` of h2…maxLevel as nested lists | roadmap: optional TOC |
| Ids | headings: folded ASCII slug, `-2` suffix, fallback `section`; footnotes `fn-1`, refs `fnref-1`, `fnref-1-2` | FIRE, English ids |
| Copy | `render` section in `messages/{en,pl}.ts`: footnotes heading, footnote label `{number}`, back to text, opens in a new tab, TOC label; option `messages` (default `en`) | AGENTS.md |
| Reading time | `getReadingMinutes(markdown, wordsPerMinute = 200)`; in the result too | FIRE |

**Critical details:**
- The renderer instance is built per call (rules close over per-call state), as FIRE does.
- The glossary rule runs after `footnote_tail` (core ruler push order) so footnote bodies are skipped.
- Plugin fences are replaced by a `blog_block` token in a core rule; the renderer emits a segment
  boundary there. The glossary rule never touches them (they are not `inline` tokens).
- `findArticleBlocks(markdown, plugins)` parses with the same instance and returns
  `{ type, info, line, requires }` for every registered fence.
- Heading text for ids takes `text` and `code_inline` children (FIRE).

## Steps

### Phase 1: renderer
1. Add the dependencies; `src/render/glossary.ts` (`createTermMatcher`, `toGlossary`).
2. `src/render/slugify.ts`, `src/render/reading-time.ts`.
3. `src/render/render-article.ts` (options, links, headings, footnotes, glossary, blocks, TOC, segments)
   and `src/render/index.ts`; export from `src/server/index.ts`.
4. Messages: `render` section in `en.ts` and `pl.ts`.

### Phase 2: tests and docs
1. `tests/render-article.test.ts` (FIRE cases in English), `tests/render-xss.test.ts`,
   `tests/render-blocks.test.ts` (chart fixture as HTML and as a node, `findArticleBlocks`),
   `tests/glossary.test.ts`, `tests/reading-time.test.ts`.
2. README: a "Rendering" section (options, plugin trust, the result).

## Validation

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Progress

- [x] Phase 1: `src/render/` (glossary, slugify, reading time, renderer, index), server exports, `render` copy, dependencies
- [x] Phase 2: five test files (renderer, glossary, XSS, blocks, reading time), README
- [x] Gates green; impl review approved
