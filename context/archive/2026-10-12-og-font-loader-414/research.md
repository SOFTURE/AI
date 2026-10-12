---
change_id: og-font-loader-414
---

# Research: og-font-loader-414

Sources: `modules/blog/src/server/og-fonts.ts`, `modules/blog/src/next/og-fonts.ts`, `modules/blog/src/{options,cli/run}.ts`,
`modules/blog/src/{server,next}/index.ts`, `modules/blog/tests/next/og-fonts.test.ts`, `modules/blog/package.json`,
`modules/blog/module.json`, `modules/seo/package.json`, `modules/seo/src/server/index.ts`,
`foundation/core/package.json`, `context/archive/2026-10-05-blog-seo-canonical/change.md`.

- The loader (`createOgFontLoader`) imports only `node:fs/promises`, `node:path` and the blog's `OgFontSource` /
  `OgFontWeight` types. The only blog-specific part is the message prefix `Blog OG card: brand.fonts[i]`.
- `loadBrandOgFonts` is a one-line wrapper with `root: process.cwd()`, in `/next`.
- Callers inside the blog: `next/og-image.tsx` (the card route), `cli/run.ts` (`softure-blog check`, asserts the exact
  message), `options.ts` (the zod schema of `brand.fonts`, owning `OG_FONT_WEIGHTS`).
- `@softure-ai/seo` is an optional peer of the blog (`peerDependenciesMeta`, `module.json` `"seo": "^0.1.0?"`); the
  blog reaches it only by dynamic import in the publish path. The 2026-10-05 change made "an app without seo still
  builds" a constraint, and solved a similar sharing need with a core contract (`getSiteUrls`).
- `@softure-ai/core` is a dependency of seo (`^0.1.0`) and blog (`^0.1.9`). Its root entry imports no `node:*`
  module (only `src/cli/` does), so a node-only loader needs its own subpath, like `./cli` and `./next`.
- `@softure-ai/seo/server` is the server-only entry ("no next/* imports") holding IndexNow and HTML to Markdown, the
  natural place for apps to find it.
- The blog's `og-fonts.test.ts` (112 lines) tests the loader through `@softure-ai/blog/next` with the
  `@fontsource/inter` dev dependency; core has no font fixture, so core's tests build minimal font bytes (signature
  plus padding) instead.
