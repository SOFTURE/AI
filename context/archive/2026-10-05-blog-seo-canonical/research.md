# Research: blog-seo-canonical

Depth: quick. Question: how do the blog's pages apply `@softure-ai/seo`'s canonical rule while seo stays an
optional peer?

## Findings

- **seo's rule** is pure: `resolveSeoSettings(options, { appOrigin, routes })` gives `siteOrigin` (seo's
  `origin` option or `appOrigin`, with `canonical.host` applied by `getSiteOrigin`) and `trailingSlash`;
  `buildCanonicalUrl(path, settings)` makes the absolute URL (`modules/seo/src/settings.ts`).
  `getCanonicalUrl(path)` in `@softure-ai/seo/next` wraps it for the app's own pages.
- **The blog's current reach of seo**: `src/discovery/submit.ts` does `import("@softure-ai/seo")` only when the
  config lists seo. It runs from the CLI only; no Next entry of the blog reaches it today.
- **Bundling**: the Next bundler (Turbopack or webpack) resolves every string `import()` in the module graph
  at build time, and a missing package fails the build (inferred from bundler behaviour, not measured here;
  BL-5's plan records that a lazy import still broke the container's esbuild bundle). A dynamic import of seo
  from `@softure-ai/blog/next` would therefore break the build of an app that uses the blog without seo.
- **A precedent for "a module provides, another asks"**: the switch-reader contract
  (`foundation/core/src/switches.ts`, docs/02-module-standard.md §7). feature-switches passes `switchReader` to
  `defineModule`; auth calls `readSwitch` from core and falls back when no module provides one; config
  validation allows at most one provider.

## Options

1. **Dynamic import of seo in the pages** (as in `submit.ts`). Rejected: breaks the build of an app without seo.
2. **Copy seo's rule into the blog** reading seo's parsed options from the config. Rejected: two copies of the
   rule drift, and the roadmap asks for seo's helper.
3. **A site-URL contract in core** (chosen): seo passes a `siteUrls` provider to `defineModule` that applies
   `resolveSeoSettings` + `buildCanonicalUrl`; core's `getSiteUrls(config)` returns the provider's answer or an
   `appOrigin` fallback; the blog asks core. No import of seo from the blog's Next code, one rule.

## Risks

- A config with two providers is ambiguous: refuse it at validation, as for the switch reader.
- Modules built by an older core have no `siteUrls` field: check with `typeof`, as `findSwitchReader` does.
- The article OG image URL (`<article>/opengraph-image`) is a file route, not a page: build it on the site
  origin without the trailing-slash rule, so `trailingSlash: true` does not give `/slug//opengraph-image`.
