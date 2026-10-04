# Plan: seo-crawler-access

Input: change.md, research.md. Complexity: medium (2 phases: the package, then the example app).

## Goal

- `@softure-ai/seo` in `modules/seo/` (from `templates/package/`, `dbSchema: null`), enabled with
  `seo({ ... })` in `softure.config.ts`. Options (zod, strict):
  - `origin` (default: the config's `appOrigin`) and `canonical: { host: "as-is" | "apex" | "www", trailingSlash: boolean }`
    (defaults `as-is`, `false`); together they give the **site origin** every absolute URL uses;
  - `robots: { allow: string[] (default ["/"]), disallow: string[] (default []) }`;
  - `crawlers: { search, onDemand, training }`, each `{ enabled: boolean (default true), extra: string[] (default []) }`;
  - `sitemap: { entries: SitemapEntry[], contributors: SitemapContributor[] }`;
  - `indexNow: { key }` (optional; 8-128 of `[a-zA-Z0-9-]`);
  - routes `sitemap: "/sitemap.xml"`, `indexNowKey: "/indexnow-key.txt"`.
- Pure builders from `@softure-ai/seo`: `buildRobots`, `buildHtmlLimitedBots(extra)`,
  `buildSitemap`, `buildCanonicalUrl`, `getSiteOrigin`, and the crawler lists as exported data.
- `@softure-ai/seo/server`: `submitToIndexNow(urls, options)`, a dry run unless `commit: true`.
- `@softure-ai/seo/next`: `robots` and `sitemap` (default exports for `app/robots.ts` and
  `app/sitemap.ts`), `serveIndexNowKey` (the key route's `GET`), `getCanonicalUrl(path)` for
  `metadata.alternates.canonical`, `getSeoSettings()` for code outside a request (BL-5's CLI).
- Example app serves `/robots.txt`, `/sitemap.xml` and `/indexnow-key.txt`, its `next.config.ts`
  uses `buildHtmlLimitedBots()`, and `e2e/seo.spec.ts` covers the three files.

**Out of scope:** blog entries in the sitemap and the IndexNow submit on publish (BL-5);
`getIndexNowPaths` (blog-specific, BL-5); per-page `robots` meta tags (each app's pages); a core-level
contributor registry; chunking over 10,000 IndexNow URLs (refused as an error value instead).

## Approach

**Starting point:** nothing SEO-related in the repository (research §Current state). FIRE's five files
are the baseline (`src/lib/ai-crawlers.ts`, `src/lib/indexnow.ts:17-114`, `src/app/robots.ts:30-100`,
`src/app/sitemap.ts:57-101`, `next.config.ts:76`).

**Chosen:** a module like `@softure-ai/ops` (no database): pure builders in `src/` with literal tests,
a thin Next adapter that reads the module's options from `getSoftureConfig()`, and a network call in
`/server` behind `fetchImpl` and a dry-run default.
Rejected: a core-level "sitemap contributor" slot on `defineModule` (touches every module's contract
for one consumer; BL-5 can pass its contributor through seo options); a static `public/<key>.txt`
written by the app (FIRE's way: one more hand-kept file that silently drifts from the config).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| IndexNow key | option `indexNow.key`, validated; app may read env itself | public by protocol | research U1 |
| Crawler lists | exported data + `extra` and `enabled` per category | extend without a release | research U2 |
| Switched-off category | its bots get a named group with `disallow: "/"` | leaving them out would let `*` admit them | plan |
| Key file location | route `/indexnow-key.txt` at the root, `keyLocation` in every submit | covers the whole host, no dynamic top-level segment | research U3 |
| Sitemap sources | `entries` + `contributors` in seo options | no core change; BL-5 adds a contributor | research U4 |
| `lastmod` | only when supplied, never invented | roadmap: real `lastmod`, never build time | research U5 |
| Failing contributor | logged, its entries skipped, the rest served | FIRE `sitemap.ts:85-90`; never a 500 | research |
| Submit result | discriminated union (`dry_run`, `submitted`, `skipped`, `failed`) | expected failures are values (AGENTS.md) | plan |
| Canonical origin | one `getSiteOrigin(options, appOrigin)` for robots, sitemap, canonical and IndexNow | one rule, no drift between lists (FIRE L-125) | plan |

**Critical details:**
- Root rule: when `disallow` contains `/`, an `allow` of `/` is written `/$`; equal-length allow and
  disallow tie in favour of allow (RFC 9309 §2.2.2), so a bare `/` would open every path.
- Every named group repeats the full `allow` and `disallow`: a bot with a named group ignores `*`
  (RFC 9309 §2.2.1).
- `htmlLimitedBots` replaces Next's list; the copy lives in the package and a test compares it with
  `HTML_LIMITED_BOT_UA_RE` of the installed Next (root dev dependency `next`).

## Phase 1: The package

**Discipline:** TDD. **Files:** `modules/seo/**`, `package-lock.json`, `README.md` (root module list).

1. `modules/seo/` copied from `templates/package/`: name `@softure-ai/seo`, `repository.directory`,
   no `private`, no `/ui` export, no `migrations/`; dependencies `@softure-ai/core`, `zod`; peer `next ^16.0.0`.
2. `src/crawlers.ts`: `AI_SEARCH_CRAWLERS`, `AI_ON_DEMAND_FETCHERS`, `AI_TRAINING_CRAWLERS` (FIRE's
   tokens), `AI_HTML_LIMITED_BOTS`, `NEXT_DEFAULT_HTML_LIMITED_BOTS`; `buildHtmlLimitedBots(extra = [])`
   → `RegExp` (default source, AI bots, escaped extras, flag `i`).
3. `src/options.ts`: the schema above, path checks (start with `/`), origin check (http(s), no path).
4. `src/origin.ts`: `getSiteOrigin({ origin, canonical })` (apex strips one leading `www.`, `www` adds
   it unless present) and `buildCanonicalUrl(path, settings)` (absolute URL, trailing slash rule, root
   stays `/`, query and hash dropped).
5. `src/robots.ts`: `buildRobots(settings)` → `{ rules, sitemap }` in Next's `MetadataRoute.Robots`
   shape (structural type, no `next` import): group `*`, one group of enabled named bots, one group
   of disabled bots with `disallow: "/"`.
6. `src/sitemap.ts`: `buildSitemap(settings, { log })` → entries with absolute URLs; `entries` then
   contributors in order; a thrown or rejected contributor is logged with its index and skipped;
   duplicate URLs keep the first; `lastModified` passed through only when given.
7. `src/server/indexnow.ts`: `submitToIndexNow(urls, { key, origin, commit = false, fetchImpl, timeoutMs, endpoint })`
   (FIRE's protocol body; URLs as paths or absolute URLs on the site host; other hosts, an empty or
   too long list and a bad key are `failed` values; `commit: false` returns `dry_run` with the body).
8. `src/next/*`: `robots()`, `sitemap()`, `serveIndexNowKey()` (200 `text/plain` key, or 404 without a
   key), `getCanonicalUrl(path)`, `getSeoSettings(config?)`; an error naming the fix when the module is
   not enabled.
9. `src/index.ts`: the `seo` factory (`defineModule`, manifest with the two routes and their mount
   lines), exports; `module.json`; `messages/{en,pl}.ts` (the module has no visible copy: an empty
   dictionary pair, as the standard requires both).
10. `README.md` of the module (twelve sections) and the root README module list.

**Tests:** crawlers (Next default copy equals `HTML_LIMITED_BOT_UA_RE`, AI UAs caught, default UAs
kept, a browser not caught, extras escaped); robots (literal allow/disallow per group, `/$` rule, no
bare `/` with `disallow: "/"`, all-open default, switched-off category blocked, extras, sitemap URL);
origin (apex/www/as-is, trailing slash, root, bad input); sitemap (order, dedupe, no invented
`lastmod`, failing contributor logged and skipped, async contributor); IndexNow (dry run sends
nothing, body shape, 200/202, 422, network error, empty list, foreign host, more than 10,000);
module (`module.json` equals manifest, defaults, refused options listing every problem); next
adapter (robots/sitemap/key route read the enabled module, 404 without key, error without module).

**Done when:**
- Automated: the seo tests pass under `npm test`; `tests/repo` passes for the new package; Gates green
  (typecheck, lint, test).

## Phase 2: Example app and e2e

**Discipline:** test-after. **Files:** `examples/next-app/{package.json,package-lock.json,softure.config.ts,next.config.ts,app/robots.ts,app/sitemap.ts,app/indexnow-key.txt/route.ts,e2e/seo.spec.ts,README.md}`.

1. `package.json`: `@softure-ai/seo: file:../../modules/seo`; lockfile by `npm install`.
2. `softure.config.ts`: `seo({ robots: { disallow: ["/account", "/admin", "/api", "/switches"] }, sitemap: { entries: [/, /pricing, /legal/...] }, indexNow: { key } })`
   with a fixed example key (public by protocol).
3. `app/robots.ts`, `app/sitemap.ts`, `app/indexnow-key.txt/route.ts`: import the package handler and
   `export default` it (the route: `export { serveIndexNowKey as GET }`); `robots.ts` and `sitemap.ts`
   add `export const dynamic = "force-dynamic"`, because both read `APP_ORIGIN` and a static
   metadata route would bake the build-time origin (the e2e build runs without it). The module README
   says the same for apps whose origin or contributors are only known at runtime.
4. `next.config.ts`: `htmlLimitedBots: buildHtmlLimitedBots()`.
5. `e2e/seo.spec.ts`: robots names the AI bots and disallows the private paths in every group and
   points at the sitemap; sitemap lists the entries as absolute URLs on `APP_ORIGIN` and no private
   path; the key file answers the key as `text/plain`; a request with GPTBot's user agent gets the
   `<title>` before `</head>` (the `htmlLimitedBots` wiring).

**Done when:**
- Automated: Gates green (typecheck, lint, test, build); `npm run e2e` passes, including `e2e/seo.spec.ts`.
- Manual: impl review recorded in `reviews/impl-review.md`.

## Risks and rollback

- Private path exposed through robots → literal tests per group; rollback: revert phase 1's commit.
- Example app build breaks on `next.config` import → caught by the e2e build; revert phase 2.
- Lockfile conflicts with BL-2 (both add workspaces) → merge master, `npm install`, never by hand.
Each phase is one commit; reverting it removes the module or the example's use of it without data.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: The package

#### Automated
- [x] 1.1 The seo tests pass (crawlers, robots, origin, sitemap, IndexNow, module, next adapter) — 2f4184a
- [x] 1.2 `tests/repo` passes with `modules/seo` as a workspace — 2f4184a
- [x] 1.3 Gates green (typecheck, lint, test) — 2f4184a

### Phase 2: Example app and e2e

#### Automated
- [x] 2.1 `npm run e2e` passes, including `e2e/seo.spec.ts` — af58b19
- [x] 2.2 Gates green (typecheck, lint, test, build) — af58b19

#### Manual
- [x] 2.3 Impl review recorded in `reviews/impl-review.md` — edde1ec (verified by agent: reviews/impl-review.md)
