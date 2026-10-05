# Implementation review: blog-og-fonts

Reviewed: commit d40ccc4 against plan.md. Verdict: **approved**; one gap filed (BF-14).

## Checks

| Check | Result |
| --- | --- |
| Outcome | `blog({ brand: { fonts: [{ name, weight, style, src }] } })` feeds `BlogArticleOgImage`: `src/next/og-fonts.ts` reads a path (from the app's root, or absolute) or fetches an `https` URL once per process, keyed by the resolved source, and checks the first four bytes (`wOFF`, `OTTO`, `00010000`, `true`; `wOF2` refused with its own reason). Without `brand.fonts` the card is rendered exactly as before (no `fonts`, no `fontFamily`). |
| Missing file | `Blog OG card: brand.fonts[1] "fonts/missing.woff": the file cannot be read (ENOENT) (<resolved path>).`; the failed read is dropped from the cache, so the next card reads again (`tests/next/og-fonts.test.ts`); the route throws it (`tests/next/og-route.test.tsx`). |
| Options | weight 100…900 in steps of 100 (default 400), style `normal`/`italic` (default `normal`), at least one font, no two with one name, weight and style; `http:` and other schemes refused; `.woff2` refused on a URL's path too (plan review S1) (`tests/module.test.ts`). |
| Card | rendered under Vitest: a PNG with the fontsource Inter differs from the default font's PNG of the same card; `getOgFontFamily` lists each name once, in order, so a `latin-ext` file under its own name covers what the first lacks. |
| Runtime | the header comment and README §8 say paths need the Node.js runtime (the route's default) and `outputFileTracingIncludes` with `output: "standalone"` (plan review W1). |
| Gates | `npm run typecheck`, `lint` and `build` green; `npm test` 3286 passed with one unrelated hook timeout in `modules/mailing/tests/deliveries.test.ts` under the parallel build's load (33/33 when rerun alone); after merging `master` (BF-4, BF-9) the blog and repository tests pass (723); the example app's `next build` passes. |
| Docs | blog README: the config example's brand line, §8 "OG card fonts", the limitation about `next/og`'s default font removed. |
| Language | English code and docs; the language gate is green. |

## Findings

- R1 (gap, BF-14 `blog-og-fonts-check`): a wrong `brand.fonts` path shows only when the first card renders in the
  running app. `softure-blog check` could read the sources with the same loader, so a CI run fails first. Out of
  this item's outcome (the roadmap asks for a message at the card); filed, not fixed.
- R2 (accepted): the cache lives for the process and is never refreshed: a font file replaced in place is picked
  up on the next deploy or restart, which is when an app's fonts change.
- R3 (accepted): the example app keeps the default font; the loader and the route are covered by unit tests with
  a real font file, and the example's `next build` checks the wiring of the route.
