---
change_id: blog-pages
title: "The blog's listing, article and glossary pages ship from @softure-ai/blog and mount in one line each"
status: in_progress
roadmap_item: BL-4
branch: claude/bl-4-fv973f
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

An app with `blog()` gets its blog pages from the package: a listing of article cards grouped by
cluster, the article page and the glossary (index and term pages), each a server component the app
mounts with one re-export line, under paths it can change (`blog({ routes })`). Pages render on the
server with ISR, carry JSON-LD (`BlogPosting`, `BreadcrumbList`, `FAQPage`, `DefinedTerm`,
`DefinedTermSet`), the "in short" box, publication and update dates, sources and an optional
disclaimer, and leave two slots to the app: a CTA and a block under the article (where the example app
puts `<Waitlist placement="blog" />`). A proxy piece answers 301 for an old slug and 410 for a withdrawn
text, an `opengraph-image` renders a card per article with the app's brand, and an optional "how our
texts are made" page explains the method. All visible copy lives in the `pl` and `en` dictionaries,
styles use `--sft-*` tokens only. The example app mounts the blog with fixture articles; e2e covers
listing, article, glossary, 301 and 410.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BL-4).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **BL-4** (roadmap `blog`, main since 2026-10-04):

> ### BL-4: Blog pages
> - **Outcome:** Pages and route handlers shipped from `@softure-ai/blog` (the ID-1 pattern), mounted by
>   the app under a configurable base path: listing with cards, article page and glossary pages, rendered
>   with ISR; JSON-LD (`Article`, `FAQPage`, `DefinedTerm`), summary box, published and updated dates,
>   sources, an optional disclaimer; slots for the app: a CTA component and the waitlist sign-up under the
>   article (`@softure-ai/waitlist` placement `blog` when enabled); 301 from slug history, 410 for
>   withdrawn articles; an OG image per article through Next's `opengraph-image` with the brand from
>   config; an optional "how our texts are made" page; every visible string in `pl` and `en`
>   dictionaries; styling with `--sft-*` tokens. The example app mounts the blog with fixture articles;
>   e2e covers listing, article, glossary, 301 and 410.
> - **Unknowns:** how the app passes its CTA (a server component slot vs. a config of link and copy);
>   whether the OG image reuses marketing-kit's Satori templates or stays on Next's `ImageResponse`.
> - **Risk:** medium. The widest surface: routing, metadata, example app and e2e.
> - **Baseline:** FIRE `src/app/blog/**`, `src/lib/blog-page.ts`, `src/lib/blog-route.ts`,
>   `src/lib/blog-proxy.ts` and their tests.

Coordinator brief (2026-10-04): only BL-4; BL-1 (`@softure-ai/seo`), BL-2 (store) and BL-3
(`renderArticle`) are on master, BL-6 runs in parallel in another thread. Notes from BL-3: render
`segments` in order (`html` through `dangerouslySetInnerHTML`, `node` as is); glossary from
`toGlossary(listArticles({ kind: "term" }))`; a term page passes `selfSlug`; `termHref` must match the
glossary route; style the renderer's `blog-*` classes.

## Constraints

- Exclusively owns `modules/blog/src/next/`, `src/ui/`, `src/proxy/`, the page copy in
  `src/messages/`, the example app's blog routes, fixtures and e2e. Small touches: `src/index.ts`
  (routes, options), `src/options.ts` (page options), `src/cli/run.ts` (reserved slugs from routes),
  `package.json` (entry points, peers), README. No change to `src/content/`, `src/db/`, `src/render/`,
  `src/quality/` (BL-6), the content hash or the tables.
- FIRE_TRACKER is read only (commit `15ec77e`): code is copied, never changed there.
- English-only code, comments and commits. User-facing copy only in the `pl`/`en` dictionaries; FIRE's
  Polish copy is not carried over (its brand, calculator and disclaimer stay FIRE's).
- Styling with `--sft-*` tokens, no raw colours in markup or CSS (NFR-3).
- No release, tag or publish; the owner tags releases (BL-8).
- Gaps found go to `roadmap-blog-followups` as `BF-` items (BF-1…BF-4 are taken), not fixed here.
- "Read next", RSS, the sitemap contributor and IndexNow are BL-5, not here.

## Notes

- Framing skipped: the roadmap item names the outcome, the baseline and the source files; the work is
  a port of FIRE's tested pages into the package pattern ID-1 already proved. The two unknowns are
  technical and research answers them. Nothing is in doubt about the problem itself.
- Research done: [`research.md`](research.md) answers both unknowns and the questions the port raises
  (where 301/410 happen, how ISR works without a database at build time, what the brand is).
