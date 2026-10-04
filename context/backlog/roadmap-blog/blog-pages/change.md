---
change_id: blog-pages
title: "Blog pages"
status: backlog
roadmap_item: BL-4
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`/blog`, article and glossary pages from the package: ISR, JSON-LD, summary box, sources, disclaimer and CTA slots, 301/410, OG image per article.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **BL-4** (roadmap `blog`, main since 2026-10-04):

> ### BL-4: Blog pages
> - **Change ID:** `blog-pages`
> - **Status:** ready
> - **Outcome:** Pages and route handlers shipped from `@softure-ai/blog` (the ID-1 pattern), mounted by the app under a configurable base path:
>   - listing with cards, article page and glossary pages, rendered with ISR;
>   - JSON-LD (`Article`, `FAQPage`, `DefinedTerm`), summary box, published and updated dates, sources, an optional disclaimer;
>   - slots for the app: a CTA component and the waitlist sign-up under the article (`@softure-ai/waitlist` placement `blog` when enabled);
>   - 301 from slug history, 410 for withdrawn articles;
>   - an OG image per article through Next's `opengraph-image` with the brand from config;
>   - an optional "how our texts are made" page;
>   - every visible string in `pl` and `en` dictionaries; styling with `--sft-*` tokens.
>
>   The example app mounts the blog with fixture articles; e2e covers listing, article, glossary, 301 and 410.
> - **Prerequisites:** BL-3 (and BL-2 through it).
> - **Unknowns:**
>   - How the app passes its CTA (a server component slot vs. a config of link and copy).
>   - Whether the OG image reuses marketing-kit's Satori templates or stays on Next's `ImageResponse`.
> - **Risk:** medium. The widest surface: routing, metadata, example app and e2e.
> - **Baseline:** FIRE `src/app/blog/**`, `src/lib/blog-page.ts`, `src/lib/blog-route.ts`, `src/lib/blog-proxy.ts` and their tests. After: the example app serves the blog, e2e green, no FIRE copy outside dictionaries.
> - **PRD refs:** FR-29, FR-9, NFR-3, NFR-6.
> - **Source (FIRE_TRACKER, read only):** `src/app/blog/**`, `src/lib/blog-page.ts`, `src/lib/blog-route.ts`, `src/lib/blog-proxy.ts`, `src/lib/blog-data.ts`

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `modules/blog/src/next/`, `modules/blog/src/ui/`, `modules/blog/messages/`; example app blog routes and e2e.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
