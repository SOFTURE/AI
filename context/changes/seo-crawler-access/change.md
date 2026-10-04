---
change_id: seo-crawler-access
title: "Any app serves robots, sitemap, canonical URLs and IndexNow from @softure-ai/seo"
status: preparing
roadmap_item: BL-1
branch: claude/project-thread-c4o57h
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

An app, with or without the blog, enables `@softure-ai/seo` in `softure.config.ts` and mounts three
one-line files to get: a `robots.txt` that names AI crawlers explicitly in three categories (search,
on-demand fetchers, training), each switchable off as one list, with the app's private paths closed
to everyone; a `sitemap.xml` built from the app's and other modules' entries with a real `lastmod`
(never the build time); one canonical origin (apex or `www`, trailing slash rule) used by
`metadata.alternates.canonical`, the sitemap and IndexNow; the public IndexNow key file and a
`submitToIndexNow(urls)` that is a dry run unless told to commit. `next.config.ts` gets an
`htmlLimitedBots` that keeps Next's default list and adds the AI bots. A reviewer checks it in the
example app: `robots.txt`, `sitemap.xml` and the key file are served and covered by an e2e.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BL-1, taken 2026-10-04).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **BL-1** (roadmap `blog`), quoted in
[`backlog-input.md`](backlog-input.md):

> - **Outcome:** A new module `@softure-ai/seo` (`modules/seo/`, copied from `templates/package/`, no database) that any app uses with or without the blog:
>   - `buildRobots(config)`: explicit allow lists for AI crawlers in three categories (search, on-demand fetchers, training), each switchable off as one list; private paths disallowed for everyone;
>   - `buildHtmlLimitedBots(extra)`: extends Next's default `htmlLimitedBots` instead of replacing it, with a guard test that compares the copied default with the installed Next;
>   - `buildSitemap(contributors)`: entries from app and module contributors with a real `lastmod`, never the build time;
>   - canonical host helper (apex vs `www`, trailing slash) for `metadata.alternates.canonical`;
>   - IndexNow: the public key file route and `submitToIndexNow(urls)` with a dry run by default and no network in tests.
>
>   The example app serves `robots.txt`, `sitemap.xml` and the key file, covered by an e2e.
> - **Unknowns:**
>   - Where the IndexNow key lives: app config (public by protocol) vs. an environment variable.
>   - Whether the crawler lists ship as data the app can extend without a release (a list update is not a breaking change).

Source (FIRE_TRACKER, read only, commit `15ec77e`): `src/lib/ai-crawlers.ts`, `src/lib/indexnow.ts`
(key and submit part), `src/app/robots.ts`, `src/app/sitemap.ts`, `next.config.ts`
(`htmlLimitedBots`) and their tests. Map: [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md).

## Constraints

- Exclusively owns: `modules/seo/`; in the example app `app/robots.ts`, `app/sitemap.ts`, the
  IndexNow key route, `e2e/seo.spec.ts`, and the seo lines of `softure.config.ts`, `next.config.ts`,
  `package.json` and its lockfile.
- Must not touch `modules/blog/` (BL-2, running in parallel in another thread). The blog's sitemap
  entries and the IndexNow submit on publish are BL-5.
- English-only code, comments and commits (AGENTS.md). FIRE_TRACKER is read only.
- No release, tag or publish (BL-8, owner).
- Gaps found on the way are not fixed here: they go to `roadmap-blog-followups` (BF-).

## Notes

- Placement: roadmap `blog`, item BL-1 (main roadmap, work now).
- Framing skipped: the outcome, scope and source are fixed by the roadmap item and the owner's
  FIRE analysis (`docs/06-fire-extraction-2.md`); this is a port of working, tested FIRE code into a
  module, with no doubt about the problem itself. Research is done (two roadmap unknowns).
