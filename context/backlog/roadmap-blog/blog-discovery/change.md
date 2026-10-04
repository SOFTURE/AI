---
change_id: blog-discovery
title: "Blog discovery: RSS, sitemap and IndexNow"
status: backlog
roadmap_item: BL-5
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

RSS feed, blog sitemap entries with a real `lastmod`, IndexNow ping on publish, "read next" by cluster with the pillar first.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **BL-5** (roadmap `blog`, main since 2026-10-04):

> ### BL-5: Blog discovery: RSS, sitemap and IndexNow
> - **Change ID:** `blog-discovery`
> - **Status:** ready
> - **Outcome:**
>   - an RSS 2.0 feed route for published articles;
>   - a sitemap contributor for `@softure-ai/seo` (BL-1) with each article's real `lastmod`;
>   - `softure-blog publish --commit` submits the changed paths (article, old slug, hub, glossary) through IndexNow, dry run without the flag;
>   - "read next" under an article: same cluster first, the pillar on top, then the newest.
> - **Prerequisites:** BL-1, BL-4.
> - **Unknowns:** Whether the IndexNow submit runs in the CLI only or also as a function the app can call after its own publishing path.
> - **Risk:** low.
> - **Baseline:** FIRE `src/lib/blog-discovery.ts`, `src/lib/indexnow.ts` (changed paths part), `src/app/blog/rss.xml/route.ts` and their tests. After: the same tests green in the package; the example app's feed and sitemap include the fixture articles (e2e).
> - **PRD refs:** FR-27, FR-29.
> - **Source (FIRE_TRACKER, read only):** `src/lib/blog-discovery.ts`, `src/lib/indexnow.ts`, `src/app/blog/rss.xml/route.ts`, `src/app/sitemap.ts` (blog part)

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `modules/blog/src/discovery/`; the blog contributor wiring in the example app.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
