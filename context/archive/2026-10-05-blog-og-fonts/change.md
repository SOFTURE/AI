---
change_id: blog-og-fonts
title: "The article OG card takes the brand's fonts from config"
status: archived
roadmap_item: BF-8
branch: claude/project-thread-hv8t9u
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

`blog({ brand: { fonts } })` gives the article OG card the brand's font files, so an app keeps the one-line
`opengraph-image.tsx` re-export instead of writing its own file around `renderArticleOgImage({ fonts })`.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-8**:

> ### BF-8: The OG card takes the brand's fonts
> - **Change ID:** `blog-og-fonts`
> - **Outcome:** `brand.fonts` (name, weight, a path or URL the server reads once and caches) feeds `BlogArticleOgImage`; a missing file fails with a message naming it; marketing-kit's subset fonts are a candidate source.
> - **Risk:** low. Cosmetic: the card uses `next/og`'s default font today.
> - **Source:** BL-4 `blog-pages` impl review R2 (`src/next/og-image.tsx`).

Current state: `modules/blog/src/next/og-image.tsx` renders the card with `ImageResponse` from `next/og`;
`renderArticleOgImage` already takes `fonts`, but `BlogArticleOgImage` (the re-exported default) never passes
any, so every app gets `next/og`'s bundled Geist. The brand option (`src/options.ts` `brandSchema`) has a name
and colours only. The backlog entry is [`backlog-input.md`](backlog-input.md).

## Constraints

- Lane D owns `modules/blog/src/next/` (`og-image.tsx`); `src/options.ts` is shared, master wins on conflicts.
- Font files are read on the server only (the OG route), never at config parse: `softure.config.ts` also
  loads in the CLI and at startup, where a font file is irrelevant.
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent.

## Notes

- Placement: roadmap `blog-followups`, item BF-8 (taken from `context/backlog/roadmap-blog-followups/`).
- Research: quick depth, on what `next/og` (Satori) accepts and how marketing-kit loads brand fonts.
- Framing skipped: the problem is not in doubt (a review finding with a named file, and the roadmap fixes the
  outcome: option shape, caching, the error on a missing file).
- Archived 2026-10-05: `blog({ brand: { fonts } })` (name, weight, style, a path or an https URL) feeds the article OG card; the route reads each source once per process, checks the font signature and names `brand.fonts[i]` and the file when it fails; gap BF-14.
