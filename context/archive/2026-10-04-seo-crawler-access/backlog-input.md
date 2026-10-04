---
change_id: seo-crawler-access
title: "SEO and AI crawler access"
status: backlog
roadmap_item: BL-1
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`@softure-ai/seo`: `robots` with explicit AI crawler lists, `htmlLimitedBots` that keeps Next's defaults, sitemap builder, canonical host, IndexNow key and submit.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **BL-1** (roadmap `blog`, main since 2026-10-04):

> ### BL-1: SEO and AI crawler access
> - **Change ID:** `seo-crawler-access`
> - **Status:** ready
> - **Outcome:** A new module `@softure-ai/seo` (`modules/seo/`, copied from `templates/package/`, no database) that any app uses with or without the blog:
>   - `buildRobots(config)`: explicit allow lists for AI crawlers in three categories (search, on-demand fetchers, training), each switchable off as one list; private paths disallowed for everyone;
>   - `buildHtmlLimitedBots(extra)`: extends Next's default `htmlLimitedBots` instead of replacing it, with a guard test that compares the copied default with the installed Next;
>   - `buildSitemap(contributors)`: entries from app and module contributors with a real `lastmod`, never the build time;
>   - canonical host helper (apex vs `www`, trailing slash) for `metadata.alternates.canonical`;
>   - IndexNow: the public key file route and `submitToIndexNow(urls)` with a dry run by default and no network in tests.
>
>   The example app serves `robots.txt`, `sitemap.xml` and the key file, covered by an e2e.
> - **Prerequisites:** none (roadmap trigger).
> - **Unknowns:**
>   - Where the IndexNow key lives: app config (public by protocol) vs. an environment variable.
>   - Whether the crawler lists ship as data the app can extend without a release (a list update is not a breaking change).
> - **Risk:** low. About 500 LOC in FIRE, no domain code.
> - **Baseline:** FIRE `src/lib/{ai-crawlers,indexnow}.ts`, `src/app/{robots,sitemap}.ts` with their tests. After: the same behaviour from the package, FIRE literals (host, key, paths) in config only.
> - **PRD refs:** FR-27, NFR-1, NFR-5.
> - **Source (FIRE_TRACKER, read only):** `src/lib/ai-crawlers.ts`, `src/lib/indexnow.ts` (key and submit part), `src/app/robots.ts`, `src/app/sitemap.ts`, `next.config.ts` (`htmlLimitedBots`)

Reference material: [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `modules/seo/`; example app `robots.ts`, `sitemap.ts` and the key route.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
