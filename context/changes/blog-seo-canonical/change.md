---
change_id: blog-seo-canonical
title: "The blog's page URLs follow the canonical rule of @softure-ai/seo"
status: in_progress
roadmap_item: BF-7
branch: claude/project-thread-wqikv3
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

The blog's canonical, Open Graph, JSON-LD and feed URLs are built on the site origin with the canonical
host and trailing-slash rule of `@softure-ai/seo` when the app lists `seo()`, and on `appOrigin` (as today)
otherwise. A blog page then never declares a canonical that differs from the one the sitemap, IndexNow and
the rest of the app use. The blog keeps working without seo, and an app without seo still builds.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups, main since 2026-10-05), item **BF-7**:

> ### BF-7: Blog URLs follow the seo canonical rule
> - **Change ID:** `blog-seo-canonical`
> - **Outcome:** the blog's pages build canonical, OG and JSON-LD URLs through `@softure-ai/seo`'s canonical URL helper when `seo()` is in the config, and on `appOrigin` otherwise; a test covers a canonical host that differs from `appOrigin` and a trailing-slash rule.
> - **Risk:** low. The example app's canonical host equals `appOrigin`; only an app with another canonical host is affected.
> - **Source:** BL-4 `blog-pages` impl review R1 (`src/next/pages.tsx` `getAbsoluteUrl`, `src/pages/json-ld.ts`).

Current state: `modules/blog/src/next/pages.tsx` builds every absolute URL as `${config.appOrigin}${path}`
(`getAbsoluteUrl`, `getJsonLdContext`), `src/pages/json-ld.ts` concatenates `ctx.origin` with paths, and the
feed (`src/next/discovery.ts`, `src/discovery/rss.ts`) resolves paths on `appOrigin`. The sitemap entries
(seo makes them absolute) and the IndexNow submit (`src/discovery/submit.ts`, dynamic import of seo in the
CLI path) already follow seo's rule. The backlog entry is [`backlog-input.md`](backlog-input.md).

## Constraints

- `@softure-ai/seo` stays an optional peer of the blog: an app without it must still run and **build** the
  blog's pages (the Next bundler resolves every `import()` it can reach).
- Lane D owns `modules/blog/src/pages/` and `modules/blog/src/next/`; `foundation/core/` and `modules/seo/`
  are touched only for the contract (master wins on conflicts).
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent.

## Notes

- Placement: roadmap `blog-followups`, item BF-7 (taken from `context/backlog/roadmap-blog-followups/`).
- Research: quick depth, on how the pages can reach seo's rule without making seo a hard dependency.
- Framing skipped: the problem is not in doubt (a review finding with a named file and function, and the
  roadmap fixes the outcome); the only open question is technical and research answers it.
