---
change_id: blog-linked-terms-without-blocks-937
title: "blog: findArticlesLinkingTerm reads linked terms without rendering (issue #937)"
status: implementing
roadmap_item: null
issue: 937
branch: claude/project-thread-y4c3hc
created: 2026-11-02
updated: 2026-11-02
---

## Intent
#937 (`bug`, `pkg: blog`): `findArticlesLinkingTerm` renders every published article in full, block plugins
included, on every glossary term page, only to read `linkedTerms`. An adopting app whose plugins compute charts paid
1.1-1.5 s per term page locally and 2-5 s p95 in production.

## Context
`modules/blog/src/pages/body.ts` (`renderPageBody`, `findArticlesLinkingTerm`), reached through
`findArticlesLinkingTermFor` in `/server` and `/next` and the ready-made term page (`next/pages.tsx`).
`modules/blog/src/render/render-article.ts` collects `linkedTerms` in the core rule `blog_glossary_links`.

## Constraints
- The same articles as before for every term: manual links and first mentions, a term never linking itself,
  footnotes and headings skipped.
- No public signature changes.

## Notes
- Framing skipped: the issue names the cause and the fix.
