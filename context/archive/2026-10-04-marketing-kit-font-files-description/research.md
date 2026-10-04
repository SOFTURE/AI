# Research: marketing-kit-font-files-description

Depth: quick. Question: what does the kit do with several files of one weight and style in `brand.fonts.<kind>.files`,
so the description can say it exactly?

## Summary

- **Schema:** `fontSchema.files` in `tools/marketing-kit/src/config/schema.ts` describes the array as "The files of
  the family, one per weight and style; none: only the fallback is used." Each file already has `unicodeRange`
  ("The characters this file covers, as a CSS unicode-range (U+0000-00FF,U+20AC); without it, all of them."). No
  refinement limits the array to one file per weight and style.
- **Film:** `fontFaces` in `src/compose/compose.ts` writes one `@font-face` per file under the same family, with
  `unicode-range` when the file has one, so the browser picks the file per character by `unicodeRange`.
- **OG images (FU-23):** `src/og/fonts.ts` registers the n-th file of a weight and style as the family
  `<family> #n` (`OgFontFamily.subsetFamilies`), and templates write `toFontFamilyCss` (`<family>, <family> #2, ...`),
  so Satori tries the files in the listed order; `unicodeRange` does not steer it. README §OG images (Fonts) says the
  same, with Fontsource `latin` and `latin-ext` as the example.
- **Generated file:** `npm run schema -w @softure-ai/marketing-kit` writes `schema/marketing.schema.json`; the text
  appears there twice (the `body` and `heading` fonts). `tests/schema.test.ts` fails on drift.

## Constraints found

- `architecture.test` forbids the FIRE font names (Geist, Newsreader) in package sources: the example must use
  generic names (Fontsource subsets `latin`, `latin-ext`).
- Lane E owns `schema.ts` and `schema/`; FU-19 (the previous item of the lane) is on master.

## Open questions

None.
