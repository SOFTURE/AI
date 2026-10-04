---
change_id: blog-og-fonts
title: "The article OG card takes the brand's fonts from config"
status: backlog
roadmap_item: BF-6
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`blog({ brand: { fonts } })` gives the article OG card the brand's font files, so an app keeps the
one-line `opengraph-image.tsx` re-export instead of writing its own file around
`renderArticleOgImage({ fonts })`.

## Context

From [`roadmap-blog-followups.md`](../../../foundation/roadmaps/roadmap-blog-followups.md), item **BF-6**:

> ### BF-6: The OG card takes the brand's fonts
> - **Change ID:** `blog-og-fonts`
> - **Status:** ready
> - **Outcome:** `brand.fonts` (name, weight, a path or URL the server reads once and caches) feeds `BlogArticleOgImage`; a missing file fails with a message naming it; marketing-kit's subset fonts are a candidate source.
> - **Risk:** low. Cosmetic: the card uses `next/og`'s default font today.
> - **Source:** BL-4 `blog-pages` impl review R2 (`src/next/og-image.tsx`).

## Constraints

- English-only code, comments and commits (AGENTS.md).

## Notes
