---
change_id: blog-markdown-renderer
title: "Safe Markdown renderer with glossary links"
status: backlog
roadmap_item: BL-3
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

Server-side Markdown renderer with an allowlist, heading anchors, glossary auto-links from term forms and a block plugin API.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **BL-3** (roadmap `blog`, main since 2026-10-04):

> ### BL-3: Safe Markdown renderer with glossary links
> - **Change ID:** `blog-markdown-renderer`
> - **Status:** ready
> - **Outcome:** `renderArticle(markdown, options)` in `@softure-ai/blog` renders on the server only:
>   - an element allowlist, no raw HTML, external links with `rel="noopener noreferrer"` and an external marker;
>   - heading ids and an optional table of contents;
>   - glossary auto-links: the first mention of a term form links to its definition, never inside headings or links;
>   - a block plugin API (a fenced block type → a server component or HTML) so domain blocks stay in the app (FIRE's engine chart becomes a plugin);
>   - reading time.
> - **Prerequisites:** BL-2.
> - **Unknowns:**
>   - Which Markdown parser (FIRE's choice vs. a smaller one) keeps the allowlist simple and the bundle server-only.
>   - How a block plugin declares its frontmatter needs, so the quality gate (BL-6) can check them.
> - **Risk:** medium. A renderer is a security boundary (stored XSS).
> - **Baseline:** FIRE `src/lib/blog-markdown.ts`, `src/lib/blog-glossary.ts` and their tests. After: the same cases plus XSS fixtures green in the package; FIRE's chart block renders through the plugin API in a test fixture.
> - **PRD refs:** FR-29, NFR-5.
> - **Source (FIRE_TRACKER, read only):** `src/lib/blog-markdown.ts`, `src/lib/blog-glossary.ts`, `src/lib/blog-chart-html.ts` (only as the plugin example)

Reference material: [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `modules/blog/src/render/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
