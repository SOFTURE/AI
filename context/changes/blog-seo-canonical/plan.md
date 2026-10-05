# Plan: blog-seo-canonical

Input: change.md, research.md. Complexity: small.

## Goal
With `seo()` in the config, the blog's canonical, Open Graph, JSON-LD and RSS URLs are built on seo's site origin
with its canonical host and trailing-slash rule (`buildCanonicalUrl`), exactly like the sitemap and IndexNow;
without seo they stay on `appOrigin` as today. The blog's Next code never imports seo, so an app without seo
still builds.

**Out of scope:** the quality gate's own-origin list (`ownOrigins`, lane C) and the renderer's own-host list
for links (see Decisions); seo's own pages and routes; the OG card's look (BF-8).

## Approach
**Starting point:** `getAbsoluteUrl` and `getJsonLdContext` in `modules/blog/src/next/pages.tsx` concatenate
`config.appOrigin` and a path; `json-ld.ts` does the same with `ctx.origin`; `next/discovery.ts` passes
`appOrigin` to `buildBlogRss` (research §Findings).

**Chosen:** a site-URL contract in core, modelled on the switch-reader contract (research option 3). Core gets
`SiteUrls { origin, getCanonicalUrl(path) }`, a `SiteUrlProvider = (config) => SiteUrls` that a module passes to
`defineModule({ siteUrls })`, and `getSiteUrls(config)` that returns the provider's answer or the `appOrigin`
fallback. seo provides it from `resolveSeoSettings` + `buildCanonicalUrl`. The blog's page code takes a
`SiteUrls` instead of an origin string.
Rejected: a dynamic import of seo in the pages (breaks an app's build without seo); a copy of seo's rule in
the blog (drift; the roadmap asks for seo's helper).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Seam | `ModuleSpec.siteUrls?: SiteUrlProvider`, `SoftureModule.siteUrls: SiteUrlProvider \| null` | same shape as `switchReader`; no new import edge | research §Options |
| Providers | at most one enabled module; config validation refuses two | an ambiguous canonical is worse than none | research §Risks |
| Fallback | `origin = appOrigin`, `getCanonicalUrl(path) = appOrigin + path` (path must start with one `/`) | today's output byte for byte | change.md |
| OG image URL | `origin + articlePath + "/opengraph-image"`, no trailing-slash rule | a file route, not a page | research §Risks |
| Feed URLs | items and channel link canonical; the feed's own `atom:link` and `<link rel=alternate>` on `origin` without the rule | a feed item links a page; `rss.xml` is a file | plan |
| Older modules | `typeof module.siteUrls === "function"` | a module built by an older core has no field | `findSwitchReader` |

**Critical details:** `JsonLdContext.origin` becomes `JsonLdContext.urls: SiteUrls` (the pages entry exports the
type; the blog is unpublished, BL-8). The body renderer keeps `origin: appOrigin` for its own-host list.

## Phase 1: The contract, seo's provider, the blog on it
**Discipline:** TDD. **Files:** `foundation/core/src/site-urls.ts` (new), `src/module.ts`, `src/config.ts`,
`src/index.ts`, `foundation/core/tests/site-urls.test.ts` (new), `tests/support.ts`, `tests/module.test.ts`,
`modules/seo/src/index.ts`, `src/settings.ts`, `modules/seo/tests/settings.test.ts`, `modules/blog/src/pages/json-ld.ts`,
`src/discovery/rss.ts`, `src/next/pages.tsx`, `src/next/discovery.ts`, blog tests (`tests/pages/json-ld.test.ts`,
`tests/discovery/rss.test.ts`, `tests/next/pages.test.tsx`, `tests/next/discovery.test.ts`, `tests/next/support.ts`),
`tests/architecture.test.ts`, READMEs of core, seo and blog, `docs/02-module-standard.md` §7,
`context/foundation/roadmap.md`, a new gap entry in `context/backlog/roadmap-blog-followups/` (plan review S1).

1. core tests (red first): `getSiteUrls` falls back to `appOrigin` (`/blog` → `https://app.example.com/blog`, a bad
   path throws); uses the one provider; config validation refuses two providers; `defineModule` refuses a
   non-function `siteUrls`.
2. core: `site-urls.ts` (`SiteUrls`, `SiteUrlProvider`, `findSiteUrlProvider`, `getSiteUrls`), the spec and module
   field, the validation, the exports.
3. seo test (red first): `getSiteUrls` of a config with `seo({ origin: "https://www.example.com", canonical: { host:
   "apex", trailingSlash: true } })` and `appOrigin` `https://app.example.com` gives origin `https://example.com` and
   `/blog/a` → `https://example.com/blog/a/`. seo passes `siteUrls` (`getSiteUrlsFromSeo`) to `defineModule`.
4. blog tests (red first): pages metadata (canonical, OG url, feed alternate), article and term JSON-LD, and the
   feed, with that seo config: canonical host and trailing slash applied, the OG image URL without a doubled slash;
   the existing cases without seo stay as they are. `tests/architecture.test.ts` (plan review W1): `src/next/`,
   `src/pages/` and `src/ui/` hold no `"@softure-ai/seo"` specifier at all and never import `discovery/submit`.
5. blog: `json-ld.ts` and `rss.ts` take `SiteUrls`; `pages.tsx` and `discovery.ts` get them from `getSiteUrls(config)`.
6. Docs: module standard §7 (a bullet next to the switch reader), core README, seo README (the blog follows its
   rule), blog README (URLs follow seo when listed).

**Tests:** steps 1, 3 and 4; every existing blog, seo and core test unchanged except the JSON-LD context shape.

**Done when:**
- Automated: core `getSiteUrls` unit cases pass (fallback, provider, two providers refused).
- Automated: seo's provider applies the canonical host and trailing-slash rule.
- Automated: blog pages, JSON-LD and feed follow seo's rule when listed and `appOrigin` otherwise; the blog's Next code holds no seo specifier.
- Automated: Gates green (typecheck, lint, test, build) and the example app's `next build`.

## Risks and rollback
- A third-party module sets `siteUrls` and clashes with seo: validation names both.
- The example's e2e expects `appOrigin` URLs: seo's rule there is `as-is` without trailing slash, so outputs are
  equal; `next build` of the example checks the wiring.
- Rollback: revert the phase commit; the blog builds URLs on `appOrigin` as before.

## Decisions (auto)
- Complexity → small (one phase).
- The renderer's own-host list (`pages/body.ts`) and the quality gate's `ownOrigins` stay on `appOrigin`: they
  decide which links are internal, not which URL a page declares; recorded as a new gap if the canonical host
  should count as internal too.
- Plan review W1 (architecture guard) and S1 (gap entry) applied.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: The contract, seo's provider, the blog on it

#### Automated
- [ ] 1.1 core `getSiteUrls` unit cases pass (fallback, provider, two providers refused)
- [ ] 1.2 seo's provider applies the canonical host and trailing-slash rule
- [ ] 1.3 blog pages, JSON-LD and feed follow seo's rule when listed and `appOrigin` otherwise; the blog's Next code holds no seo specifier
- [ ] 1.4 Gates green (typecheck, lint, test, build) and the example app's `next build`
