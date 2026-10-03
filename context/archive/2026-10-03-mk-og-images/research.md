# Research: mk-og-images

Input: change.md, roadmap MK-5, research.sources (`docs/03-marketing-kit.md`; FIRE_TRACKER is not
reachable from this session: `git clone` asks for credentials, so FIRE's `opengraph-image.tsx`,
`og-card` and `og-palette` are described from the docs and the roadmap baseline, not read). Depth:
light (one new directory, two npm dependencies, no data). Snapshot: acb06d2 (master after PR #36),
2026-10-03.

## Summary

- FIRE renders its OG cards with Next's `ImageResponse` (Satori) at 1200×630, with TTF fonts and the
  palette as constants, and with numbers computed by the FIRE engine (`docs/03-marketing-kit.md:14`).
  Its tests check the card and the palette and that the card only uses font weights that are loaded
  (roadmap MK-5, Unknowns and Baseline).
- `satori` (0.35.0, MPL-2.0) runs outside Next on plain element objects (`{ type, props }`), no React
  or JSX needed; `@resvg/resvg-js` (2.6.2, MPL-2.0, prebuilt native binary) turns its SVG into a PNG.
  Measured here: a 1200×630 card with a heading, a path chart and two Inter weights renders to a
  16 kB PNG in well under a second.
- The contract already has a place for the images: `ogImages: [{ id, template, size = [1200, 630],
  data = {} }]` (`src/config/schema.ts`, `ogImageSchema`), unique ids checked in the root
  `superRefine`, carried as is to `config.ogImages` (`src/config/config.ts`). It has no behaviour yet.
- The brand gives fonts (`brand.fonts.heading|body`, files with weight and style, `.woff2|.woff|.ttf|.otf`),
  nine colour roles resolved to hex (`resolveBrandColors`), a logo SVG and a name.

## Measured Satori behaviour (this session, satori 0.35.0)

| Case | Result |
| --- | --- |
| `.woff2` font | throws `Unsupported OpenType signature wOF2` |
| no font at all | throws `No fonts are loaded. At least one font is required…` |
| `fontWeight: 700` with only 400 loaded | renders 400 silently (identical SVG) |
| `.woff` (Fontsource Inter latin) | works |
| inline `<svg><path d=…>` child | works (the chart case) |

The silent weight fallback is the reason FIRE's tests insist on loaded weights: a template asking
for a weight the brand does not ship looks right in code and wrong in the PNG. A variable font
(`weight: "100 900"`) renders only its default instance in Satori (inferred from its opentype.js
font loading, not measured), so a range cannot honour a requested weight either.

## Options

- **A. Templates as functions over plain element objects, weights chosen from the loaded files.**
  Each template gets `{ data, size, palette, fonts, brand }` and returns a Satori tree. The font helper
  loads only static `.ttf|.otf|.woff` files and tells the template which weights exist; templates pick
  the nearest loaded weight, so they cannot ask for an unloaded one by construction, and a test walks
  every tree to assert it. Data is validated per template by zod; `ogImages` becomes a union on
  `template`, so the JSON Schema documents each template's `data`.
- **B. `@vercel/og` outside Next.** Bundles Satori, resvg-wasm and a default font; heavier, ties the
  package to Vercel's packaging and its edge/wasm split for no gain outside Next.
- **C. Templates as HTML rendered by Playwright screenshots.** Reuses the browser the kit already
  needs, but drags Chromium into a Next route and loses Satori parity with FIRE's cards.

Recommended: **A** (the roadmap names `satori` + `@resvg/resvg-js`; smallest dependency set; the weight
rule holds by construction and is tested).

## Unknowns from the roadmap

1. **Do `satori` + `@resvg/resvg-js` reproduce FIRE's cards closely enough?** Next's `ImageResponse`
   is Satori plus resvg (wasm), so the layout engine and rasteriser are the same family; the cards a
   template draws are the same flexbox subset. Pixel parity with FIRE's current PNGs cannot be checked
   here (FIRE is unreachable); it is part of FIRE's own migration, which verifies its cards when it
   adopts the package.
2. **Font loading rules.** Only static files Satori can parse (`.ttf`, `.otf`, `.woff`), one weight
   each; `.woff2` and variable ranges are refused with the JSON path of the file. Only weights that
   are loaded are used: templates choose from the loaded set, and a test asserts it on every tree.

## Constraints and risks

- `@resvg/resvg-js` ships a native binary per platform (optional dependencies); CI is linux x64 like
  this container. A PNG byte snapshot is only stable for one resvg build and one font file, so the
  snapshot test pins both (the test fonts come from the `@fontsource/inter` dev dependency, OFL-1.1,
  not committed).
- Fonts with a subset (Fontsource `latin`) miss glyphs outside it; Satori then draws nothing for them
  without an error. Detecting missing glyphs is out of scope (a gap for followups).
- A Next route must not load Playwright: the `og` entry must not import `src/record/`. `film.ts`
  imports Playwright types only, which are erased.
- Shared files with the parallel items: `schema.ts` + `marketing.schema.json` (MK-3, MK-4 extend
  their sections), `cli/main.ts`, `cli/options.ts` (MK-4 adds `shots`), `index.ts`, `package.json`,
  `package-lock.json`. Master wins; re-apply on conflict.
