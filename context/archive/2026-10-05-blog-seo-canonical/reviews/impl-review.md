# Implementation review: blog-seo-canonical

Reviewed: commit 80562ce against plan.md. Verdict: **approved**; one gap filed (BF-11, from plan review S1).

## Checks

| Check | Result |
| --- | --- |
| Outcome | With `seo()` listed, the blog's canonical, OG, JSON-LD (article, crumbs, brand, term, glossary) and feed URLs come from core's `getSiteUrls`, which seo provides through `buildCanonicalUrl`; without seo they stay `appOrigin` + path byte for byte (the existing blog tests pass unchanged). |
| Roadmap test | A canonical host that differs from `appOrigin` (`origin: https://www.example.org`, `host: apex`) and `trailingSlash: true` in `tests/pages/json-ld.test.ts`, `tests/discovery/rss.test.ts`, `tests/next/pages.test.tsx` and `tests/next/discovery.test.ts`; seo's provider in `modules/seo/tests/settings.test.ts`. |
| Contract | `foundation/core/src/site-urls.ts`: one provider at most (config validation names both), `typeof` check for modules built by an older core, `defineModule` refuses a non-function; unit cases in `tests/site-urls.test.ts` and `tests/module.test.ts`. |
| Optional seo | The blog's Next, pages and ui code hold no `@softure-ai/seo` specifier (new architecture case, plan review W1); the example app's `next build` passes. |
| Files, not pages | The OG image URL and the feed's own URL are on the site origin without the trailing-slash rule (no `/slug//opengraph-image`); a crumb's fragment (a cluster anchor) is kept after the canonical URL. |
| Gates | `npm run typecheck`, `lint`, `test` (3215 passed) and `build` green; the example app's `next build`, and its `blog.spec.ts` and `seo.spec.ts` e2e (15 passed) on a local Postgres. |
| Docs | Module standard §7, core README §7, seo README, blog README (feature line; the BF-7 limitation replaced by BF-11). |
| Language | English code and docs; the language gate is green. |

## Findings

- R1 (gap, BF-11 `blog-canonical-host-links`): the renderer's own hosts (`pages/body.ts`) and the gate's own origins
  (`quality/settings.ts`) still read `appOrigin` only; a body link to a different canonical host is marked external
  unless the app lists it. Out of this item's outcome and partly in lane C; filed, not fixed.
- R2 (accepted): `submitBlogChanges` keeps resolving seo's settings itself (it needs the IndexNow key and route as
  well); its URLs use the same `buildCanonicalUrl`, so they agree with the pages.
- R3 (accepted): `getSiteUrls` runs the provider on each call (a page's metadata asks a few times); resolving seo's
  settings is a few object reads and one `URL` parse, so no cache.
