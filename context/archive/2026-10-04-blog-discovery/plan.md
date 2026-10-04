# Plan: blog-discovery

Input: change.md, research.md. Complexity: medium (pure logic ported with its tests, three thin Next
pieces, one CLI step, the example app and e2e).

## Goal

`@softure-ai/blog` makes its texts discoverable: `/blog/rss.xml` from `serveBlogRss`, sitemap entries
from `blogSitemap()` for `seo({ sitemap: { contributors } })`, an IndexNow submit of the changed
addresses after `softure-blog publish --commit` (and as `submitBlogChanges` for the app's own
publishing path), and "read next" under every article. The example app mounts it and its e2e sees the
fixture articles in the feed and the sitemap.

**Out of scope:** blog URLs on the seo canonical rule (BF-7); refreshing a running app's cache after a
CLI publish (BF-10, research Q5); FIRE's calculator reading list and copy.

## Approach

**Chosen:** pure functions in `src/discovery/` (no React, no Next, no seo import: dates, sitemap
entries, RSS XML, related articles, IndexNow paths), one server function that reaches seo through a
dynamic import only when the config lists `seo()`, and thin Next pieces in `src/next/discovery.ts`
over the cached reads. Rejected: a hard dependency on `@softure-ai/seo` (an app without seo could not
install the blog), reading the database in the contributor without the cache (one query per sitemap
request), a sitemap hook in core (BL-1 chose contributors).

**Key decisions:**

| Decision | Choice | Why |
| --- | --- | --- |
| seo coupling | `@softure-ai/seo` optional peer + devDependency; manifest `dependsOn: { seo: "^0.0.0?" }`; `import("@softure-ai/seo")` and `import("@softure-ai/seo/server")` only when `getModule(config, "seo")` is set | research Q1 |
| Settings | `resolveSeoSettings(module.options, { appOrigin, routes })` from seo's root entry, not `getSeoSettings` of `/next` | research Q1 |
| Paths | `getIndexNowPaths(changes, routes)`: FIRE's rule, paths from `getTextPath` and the routes; texts first, then hubs (`routes.index`, `routes.glossary`) | FIRE |
| Submit | `submitBlogChanges(config, changes, { commit?, fetchImpl? })` → `{ paths, outcome }`, `outcome` one of `not_configured` (seo not listed, or no IndexNow key) or seo's `skipped`/`dry_run`/`submitted`/`failed`; never throws | research, unknown |
| CLI | after a `done` run: submit with `commit = run.committed`; `--no-indexnow` turns it off; a failure prints a warning and keeps exit 0 | FIRE, research Q6 |
| Sitemap | `getBlogSitemapEntries({ articles, terms, routes, methodPath })`: hub + articles only with an article, glossary + terms only with a term, the method page without a date when mounted; priorities 0.7/0.6/0.5 | FIRE |
| Contributor | `blogSitemap(config?)` in the root entry, one `listArticles` query per sitemap request (no `next/*`); config read at call time; entries are seo's structural `SitemapEntry` | research Q3 (updated in phase 3) |
| RSS | `buildBlogRss({ articles, terms, origin, routes, feedPath, channel, getCategory })`; FIRE's XML; channel title from `pages.blogTitle` with the brand (`titleWithBrand`), description `pages.blogDescription`, `language` = locale | FIRE, research Q2 |
| Feed route | manifest route `rss: "/blog/rss.xml"`, mount `app/blog/rss.xml/route.ts` → `serveBlogRss`; 503 + `retry-after` with copy `feed.unavailable` on a read failure, logged without the stack | FIRE |
| Feed links | `alternates.types["application/rss+xml"]` on the listing and article metadata | FIRE |
| Read next | `getRelatedArticles(article, published)` with `RELATED_LIMIT = 4`, `PILLAR_RELATED_LIMIT = 6`; `BlogArticleView({ related })` renders `blog-related` with heading `pages.readNext`, title link and description | FIRE |

**Critical details:**
- `lastmod` is `updatedAt ?? publishedAt`; a published text without `publishedAt` is impossible
  (BL-2), so the function throws a named error rather than inventing a date.
- `src/discovery/` must not import `next/*` (ESLint rule list) or `@softure-ai/seo` statically; an
  architecture test checks the second.
- The feed escapes `& < > " '`; `guid` is the id with `isPermaLink="false"`; the body is not in the feed.
- The cached reads return dates revived (`reviveDates`), so `lastmod` is a `Date`.

## Phase 1: discovery logic, submit and CLI

1. `src/discovery/` with `dates.ts`, `sitemap.ts`, `rss.ts`, `related.ts`, `indexnow.ts`, `submit.ts`,
   `index.ts`; exported from `/server`. Tests port FIRE's cases (hand-written oracles), plus routes
   other than `/blog`, the method page and the submit outcomes (no seo, no key, dry run, submitted
   through an injected fetch, failed).
2. CLI: `--no-indexnow`, the submit after a run, usage text; tests for each line and the exit codes.
3. Manifest: route `rss`, mount line, optional seo dependency; `module.json` mirrored; package peers.
4. Gates (typecheck, lint, test).

## Phase 2: Next pieces, copy, UI

1. Copy `pages.readNext`, `feed.unavailable` in `en` and `pl`.
2. `BlogArticleView` "read next" section and styles; render test.
3. `src/next/discovery.ts`: `serveBlogRss`, `blogSitemap`; feed links in metadata; related list on the
   article page. Tests over the PGlite blog (feed, 503, contributor entries, related on the page).
4. README (feed, sitemap, IndexNow, read next). Gates incl. build.

## Phase 3: example app and e2e

1. `seo({ sitemap: { contributors: [blogSitemap()] } })`, `app/blog/rss.xml/route.ts`
   (`force-dynamic`), `blog:fixtures` with `--no-indexnow`.
2. e2e: the sitemap lists the fixture texts with `lastmod`, the feed lists them, "read next" under an
   article; the seo spec's exact sitemap list updated.
3. `npm run e2e` green locally.

## Risks and rollback

- Importing `@softure-ai/blog/next` from `softure.config.ts` loads `next/*` in the plain-Node scripts
  (`softure migrate`, `scripts/blog.ts`); checked in phase 3, fallback: a lazy import inside the
  contributor.
- Rollback: revert the merge; no table or data change.

## Decisions (auto)

- Unknown: both CLI and function (research).
- `--no-indexnow` opt-out instead of a loopback rule (research Q6).
- Feed URLs on `appOrigin`, like the pages (BF-7 moves both).
- `blogSitemap()` in the root entry without the Next cache: plain Node cannot load `/next` (phase 3), and a lazy import of it still broke the container's esbuild bundle of `softure.config.ts` (CI), so the contributor queries the database directly.
- IndexNow URLs go to seo as canonical URLs (`buildCanonicalUrl`): seo's submit resolves paths on the
  origin without the trailing-slash rule, so a path alone would submit a non-canonical address.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: discovery logic, submit and CLI

#### Automated
- [x] 1.1 Discovery functions and their tests — 812cf9a
- [x] 1.2 CLI submit and `--no-indexnow` — 812cf9a
- [x] 1.3 Manifest route, mount, optional seo dependency — 812cf9a
- [x] 1.4 Gates green (typecheck, lint, test) — 812cf9a

### Phase 2: Next pieces, copy, UI

#### Automated
- [x] 2.1 Copy in `en` and `pl` — 7ed5177
- [x] 2.2 "Read next" section and styles — 7ed5177
- [x] 2.3 Feed route, sitemap contributor, feed links, related on the page — 7ed5177
- [x] 2.4 README; gates green (typecheck, lint, test, build) — 7ed5177

### Phase 3: example app and e2e

#### Automated
- [x] 3.1 Example app wires the contributor, the feed and `--no-indexnow` — a85b673
- [x] 3.2 e2e for feed, sitemap and read next — a85b673
- [x] 3.3 `npm run e2e` green locally — a85b673
