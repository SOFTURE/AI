---
change_id: blog-markdown-renderer
title: "Article Markdown renders to safe HTML on the server, with glossary links and app block plugins"
status: active
roadmap_item: BL-3
branch: claude/bl-3-5nxhvu
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

The blog pages (BL-4) turn an article's `bodyMarkdown` into HTML with one server-only call,
`renderArticle(markdown, options)` from `@softure-ai/blog/server`. Whatever an author writes, the
output holds only the elements Markdown itself produces (raw HTML is escaped, unsafe link schemes stay
text), external links are marked and open safely, headings carry stable ids for a table of contents,
the first mention of a glossary term links to its definition, and a fenced block of a type the app
registers is rendered by the app's plugin (FIRE's engine chart becomes such a plugin). The call also
returns the reading time. FIRE's renderer and glossary cases pass in the package, plus XSS fixtures.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BL-3).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **BL-3** (roadmap `blog`, main since 2026-10-04):

> ### BL-3: Safe Markdown renderer with glossary links
> - **Outcome:** `renderArticle(markdown, options)` in `@softure-ai/blog` renders on the server only:
>   an element allowlist, no raw HTML, external links with `rel="noopener noreferrer"` and an external
>   marker; heading ids and an optional table of contents; glossary auto-links (first mention, never inside
>   headings or links); a block plugin API (a fenced block type → a server component or HTML); reading time.
> - **Unknowns:** which Markdown parser; how a block plugin declares its frontmatter needs for BL-6.
> - **Risk:** medium. A renderer is a security boundary (stored XSS).
> - **Baseline:** FIRE `src/lib/blog-markdown.ts`, `src/lib/blog-glossary.ts` and their tests.

Coordinator brief (2026-10-04): only BL-3; BL-1 and BL-2 are on master. Notes from BL-2: render from
`articles.bodyMarkdown`; glossary forms come from `termForms` of `kind = "term"` rows
(`listArticles({ kind: "term" })` returns whole rows); the content hash is a contract (a new field
enters it only when present). BL-6 (`src/quality/`) may run in parallel in another thread.

## Constraints

- Exclusively owns `modules/blog/src/render/`; touches `src/server/index.ts` (exports),
  `src/messages/` (render copy), `package.json` (dependencies) and the module README. No change to
  `src/content/`, `src/db/`, `src/quality/`, the content hash, the example app or `modules/seo/`.
- FIRE_TRACKER is read only (commit `15ec77e`): code is copied, never changed there.
- English-only code, comments and commits. User-facing copy (footnote heading, "opens in a new tab",
  table of contents label) only in the `pl`/`en` dictionaries.
- No release, tag or publish; the owner tags releases (BL-8).
- Gaps found go to `roadmap-blog-followups` as `BF-` items, not fixed here.

## Notes

- Framing skipped: the roadmap item names the outcome, the baseline and the source files, and the
  work is a port of a tested FIRE renderer with two open unknowns that research answers. Nothing is
  bug-shaped or in doubt about the problem itself.
- Research done: it answers the parser and plugin-declaration unknowns and lists what in FIRE's
  renderer is FIRE-specific (own host, Polish footnote copy, the `::wykres{}` directive, the glossary path).
