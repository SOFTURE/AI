# Plan: blog-adoption-gaps

Input: change.md (research and framing skipped, reasons there). Complexity: medium (three phases).

## Today (master `a0dbf19`)

- **Marker.** `addExternalLinks` (`src/render/render-article.ts`) always appends
  `<span class="blog-external-marker" aria-hidden="true">↗</span><span class="blog-visually-hidden"> {opensInNewTab}</span>`
  to a link off the site. `RenderArticleOptions` has no switch; the pages call the renderer only through
  `renderPageBody` (`src/pages/body.ts`), which picks `blocks`, `images` and `siteHosts` from the blog options.
- **Paths.** `qualityOptionsSchema.paths` defaults to `{ articles: "/blog", terms: "/blog/glossary" }` on its own.
  `getQualitySettings(config)` (`src/server/options.ts`) has the config, so it can read `getBlogRoutes(config)`;
  `resolveQualitySettings` is also public and called by tests without a config. Readers of the paths: the internal
  link resolver in `runCheck` (`src/cli/run.ts`) and the writing skill's values (`src/cli/skill.ts`).
- **Pages.** `src/next/pages.tsx` keeps the metadata (`getStaticMetadata`, `getTextMetadata`, canonical URL, feed
  alternates, brand title) and the JSON-LD context as private helpers inside the page module. The `generate*Metadata`
  functions read the text by slug themselves; nothing takes an article the app already holds. `BlogArticleOgImage`
  needs no view and already mounts next to an app's own page.
- **410.** `buildGonePage(copy, { lang, indexPath })` (`src/pages/redirects.ts`) writes one link to the listing;
  `createBlogRedirects` (`src/proxy/index.ts`) builds the page once from the messages.
- **History.** `parseArticleHistory` (`src/db/history.ts`) turns every timestamp into a `Date` (milliseconds);
  `publishArticle` inserts it through drizzle's `timestamp` column (mode `date`). Only the insert of a new row reads
  the history.

## Goal

`@softure-ai/blog` 0.1.8 with all five points of #228, today's behaviour the default.

**Out of scope:** replaceable views inside the ready-made pages (the builders cover the gap the issue names); styling
the 410 page beyond what the app's own render function writes.

## Key decisions

- **Marker (1):** renderer option `externalMarker?: "icon-and-text" | "text" | "none"` (default `"icon-and-text"`):
  `"text"` drops the `↗` span and keeps the visually hidden words, `"none"` drops both. Every external link keeps
  `target`, `rel` and the `blog-external` class (a hook for the app's own CSS marker). Blog option
  `externalLinkMarker` with the same values feeds the pages through `renderPageBody`. An option, not
  `opensInNewTab: null`: message dictionaries hold strings.
- **Paths (2):** `quality.paths.articles` and `.terms` become optional with no default. `QualitySettings` gains
  `paths: { articles, terms }`, resolved by `resolveQualitySettings` from the explicit field, else from
  `routes` (`articles: routes.index`, `terms: routes.glossary`) passed in by `getQualitySettings`, else
  `/blog` and `/blog/glossary` (a caller without a config). The link resolver and the skill read `settings.paths`.
  `QualityOptions.paths` is now the override only (CHANGELOG notes it).
- **Pages (3):** builders from `/next`, pure over what the app passes (no database read, no request scope):
  `buildArticleMetadata(config, article)`, `buildTermMetadata(config, term)`,
  `buildBlogIndexMetadata(config, { isEmpty })`, `buildGlossaryIndexMetadata(config, { isEmpty })`,
  `buildMethodMetadata(config)`; `buildArticleJsonLd(config, article)`, `buildTermJsonLd(config, term)`,
  `buildGlossaryJsonLd(config, terms)` returning the serialized `<script>` content (or `null` for no terms).
  New `src/next/metadata.ts` and `src/next/json-ld.ts`; `pages.tsx` uses them, so pages and builders cannot drift.
  README shows an own page using them, and that `generate*Metadata` and `BlogArticleOgImage` mount next to an own page.
- **410 (4):** blog option `gonePage?: { links?: { href, label: LocalizedText }[]; render?: (input) => string }`.
  `links` (site paths or https URLs, at most 5) follow the link to the listing, each escaped. `render({ copy, lang,
  indexPath, links })` replaces the whole body (the app's own HTML, trusted like block plugins); the response keeps
  status 410 and `content-type`. `buildGonePage` takes `links`.
- **History (5):** `ArticleHistory` keeps the timestamps as the ISO strings they were given
  (`publishedAt: string | null`, `updatedAt`, `oldSlugs[].changedAt`); `publishArticle` inserts them with
  `${value}::timestamptz`, so Postgres keeps microseconds (its own limit; digits past six are rounded by Postgres, as
  README states). A file's `published_at` and the clock still go in as `Date`. Breaking for code that builds an
  `ArticleHistory` by hand (CHANGELOG notes it); `parseArticleHistory` callers see no change.

## Phases

### Phase 1: renderer marker and quality paths (TDD)

- `render-article.ts` (`externalMarker`), `pages/body.ts`, `options.ts` (`externalLinkMarker`), `quality/options.ts`,
  `quality/settings.ts` (`paths`), `server/options.ts`, `cli/run.ts`, `cli/skill.ts`.
- Tests: each marker value's exact HTML; a page body follows the blog option; the paths come from changed routes,
  an explicit field wins, no routes gives the old defaults; `softure-blog check` resolves a link under a moved
  glossary without `quality.paths`.
- Done when: blog tests green.

### Phase 2: metadata and JSON-LD builders, 410 links (TDD)

- `next/metadata.ts`, `next/json-ld.ts`, `next/pages.tsx`, `next/index.ts`, `pages/redirects.ts`, `proxy/index.ts`,
  `options.ts` (`gonePage`).
- Tests: builders give the same metadata and JSON-LD the pages gave (canonical, robots, OG, feed alternates); gone page
  with extra links escaped; the proxy's 410 uses `render` when given; bad `gonePage` options refused at startup.
- Done when: blog tests green.

### Phase 3: history precision, docs, version

- `db/history.ts`, `db/articles.ts`; README (rendering, configuration, mounting own pages, 410, history import),
  CHANGELOG, version 0.1.8 (package.json, module.json, `src/index.ts`).
- Tests: a history import with `…:12.421579Z` reads back as `2026-…12.421579+00` through `published_at::text`;
  updated and changed-at likewise.
- Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: renderer marker and quality paths

- [ ] externalMarker and externalLinkMarker with tests
- [ ] quality paths from routes with tests

### Phase 2: builders and 410 links

- [ ] metadata and JSON-LD builders with tests
- [ ] gonePage links and render with tests

### Phase 3: history precision, docs, version

- [ ] history timestamps kept as text with tests
- [ ] README, CHANGELOG, version 0.1.8
- [ ] gates green
