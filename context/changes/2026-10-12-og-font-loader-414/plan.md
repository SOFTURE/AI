---
change_id: og-font-loader-414
status: open
---

# Plan: OG font loader outside the blog (issue #414)

Input: change.md, research.md. Complexity: small (one module moved, three re-exports, docs).

## Phase 1: the loader in core, re-exported by seo and blog (TDD)

Files: new `foundation/core/src/og/{index,og-fonts}.ts`, `foundation/core/package.json` (`./og` export),
`modules/seo/src/server/index.ts`, `modules/blog/src/server/og-fonts.ts`, `modules/blog/src/next/og-fonts.ts`,
`modules/blog/src/options.ts`; tests `foundation/core/tests/og-fonts.test.ts`, `modules/seo/tests/og-fonts.test.ts`.

1. Tests first, red on master:
   - core: `createOgFontLoader` reads a relative path from `root` once (cache), accepts ttf/otf/woff signatures,
     rejects woff2 and other bytes with the default `OG card: fonts[i] "src": reason (location).` message, uses
     `label` when given, fetches https sources, does not cache a failure; `loadOgFonts` reads from `process.cwd()`.
   - seo: `@softure-ai/seo/server` exports the same `createOgFontLoader` and `loadOgFonts` as `@softure-ai/core/og`.
2. Implement: move the loader body to `foundation/core/src/og/og-fonts.ts` with `OgFontSource` (plain interface),
   `OgFontWeight`, `OG_FONT_WEIGHTS`, `OgFont`, `OgFontsResult`, `OgFontLoaderOptions` (`label?`), `loadOgFonts`.
   Blog: `server/og-fonts.ts` becomes a wrapper that passes `label: "Blog OG card: brand.fonts"` and re-exports the
   types; `options.ts` takes `OG_FONT_WEIGHTS` / `OgFontWeight` from core; blog tests stay unchanged and green.

## Phase 2: docs

READMEs: core (the `/og` entry, one paragraph), seo (the loader in `/server`, usage in an `opengraph-image` route),
blog (line pointing to seo for non-blog cards). CHANGELOG `## Unreleased` in core, seo and blog.

## Progress

- [ ] Phase 1: the loader in core, re-exported by seo and blog
- [ ] Phase 2: docs
