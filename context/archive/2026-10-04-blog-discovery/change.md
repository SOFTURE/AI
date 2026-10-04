---
change_id: blog-discovery
title: "The blog is found: an RSS feed, sitemap entries with real dates, IndexNow on publish and \"read next\" under each article"
status: archived
roadmap_item: BL-5
branch: claude/bl-5-2yucrl
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

Readers, feed readers and search engines find the blog's texts without the app writing any glue:

- an RSS 2.0 feed of the published articles and terms, served by a route handler the app mounts in
  one line (`app/blog/rss.xml/route.ts`), linked from the listing and every article;
- a sitemap contributor for `@softure-ai/seo` (BL-1) that lists the listing, the articles, the glossary
  and its terms, each with its real `lastmod` (the last change of its content, never a build date);
- `softure-blog publish --commit` submits the addresses whose answer changed (the text, its old slug,
  the hub of its kind) through IndexNow when the app enables `seo({ indexNow })`; without `--commit`
  it prints the request it would send; the same submit is a function the app can call after its own
  publishing path;
- "read next" under an article: its cluster first with the pillar on top, then pillars and the newest
  of the other clusters.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BL-5).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **BL-5** (roadmap `blog`, main since 2026-10-04):

> - **Outcome:** an RSS 2.0 feed route for published articles; a sitemap contributor for
>   `@softure-ai/seo` (BL-1) with each article's real `lastmod`; `softure-blog publish --commit` submits
>   the changed paths (article, old slug, hub, glossary) through IndexNow, dry run without the flag;
>   "read next" under an article: same cluster first, the pillar on top, then the newest.
> - **Unknowns:** whether the IndexNow submit runs in the CLI only or also as a function the app can
>   call after its own publishing path.
> - **Baseline:** FIRE `src/lib/blog-discovery.ts`, `src/lib/indexnow.ts` (changed paths part),
>   `src/app/blog/rss.xml/route.ts` and their tests. After: the same tests green in the package; the
>   example app's feed and sitemap include the fixture articles (e2e).

Coordinator brief (2026-10-04): only BL-5. BL-1 (`@softure-ai/seo`), BL-2, BL-3, BL-4 and BL-6 are on
master; BL-7 runs in parallel. Notes from BL-1: the sitemap entries come through a
`SitemapContributor` the app passes to `seo({ sitemap: { contributors } })`; IndexNow through
`submitToIndexNow` of `@softure-ai/seo/server` with the seo settings; the sitemap route must be
`force-dynamic` when a contributor reads the database. Notes from BL-4: "read next" goes into
`BlogArticleView`; the cached reads carry the tag `softure-blog`; blog URLs are built on `appOrigin`
(gap BF-7, not fixed here).

## Constraints

- Exclusively owns `modules/blog/src/discovery/` and the blog contributor wiring in the example app.
  Small touches: `src/next/` (feed route, contributor, related list on the article page, feed link in
  metadata), `src/ui/blog-article.tsx` (the "read next" section), `src/cli/run.ts` (the submit after a
  publish), `src/server/index.ts`, `src/index.ts` and `module.json` (the feed route, the optional seo
  dependency), copy in `src/messages/`, `styles.css`, README, `package.json`.
- No change to `src/content/`, `src/db/`, `src/render/`, `src/quality/`, the tables or the content hash.
- `@softure-ai/blog` must keep working without `@softure-ai/seo`: seo is an optional peer.
- FIRE_TRACKER is read only (commit `15ec77e`).
- English-only code, comments and commits; user-facing copy only in the `pl`/`en` dictionaries.
- No release, tag or publish; the owner tags releases (BL-8).
- Gaps found go to `roadmap-blog-followups` as `BF-` items (BF-1…BF-8 are taken). BF-7 (blog URLs and
  the seo canonical rule) is already there and is not fixed here.

## Notes

- Research done: [`research.md`](research.md) answers the unknown and the questions the port raises
  (how blog reaches seo without depending on it, which origin each URL uses, cache freshness after a
  publish).
- Done: implementation review approved ([`reviews/impl-review.md`](reviews/impl-review.md)); gap BF-10
  filed in the followups roadmap.
- Framing skipped: the roadmap item names the outcome, the baseline and the source files; the work is
  a port of FIRE's tested discovery code onto seams BL-1 and BL-4 already built. The problem itself is
  not in doubt.
