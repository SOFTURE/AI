---
change_id: marketing-kit-font-file-info-1174
title: "marketing-kit: read an uploaded font file's family, weight, style and uses; glyph check on a file"
status: archived
roadmap_item: null
issue: 1174
branch: claude/project-thread-vbd7hq
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent
An adopting app lets its owner upload a brand font (`.ttf`, `.otf`, `.woff`, `.woff2`) and stores it as a
`BrandFont`. It needs the file's family, weight (or variable `wght` range) and style, and needs to know at upload
whether the file works for captions, the footage draft and the photo cover, plus which required characters it lacks.

## Scope
- New `readFontFileInfo(data)` in `src/og/font-file.ts` (exported from `.` and `./og`): family, weight (static or
  variable range, plus the CSS weight string `BrandFont` takes), style, format, and a verdict per use
  (`captions`, `draft`, `cover`) with a reason code and an English detail when unusable. Error values, never exceptions.
- `.ttf`, `.otf`, `.woff` and `.woff2` are read; WOFF2 tables are Brotli-decompressed (`node:zlib`). The table
  readers need no transform: `name`, `OS/2`, `head`, `fvar` and `cmap` are never transformed in WOFF2.
- `readCharacterMap` reads WOFF2 too; new `findMissingCharacters(data, characters)`.
- Out of scope: drawing a `.woff2` on the cover (Satori does not read it; decompressing the transformed `glyf`
  table to TTF is a large job). The reader says the file is not usable for the cover instead (issue option 2b).

## Decisions (auto)
- Cover support for WOFF2 is reported, not added: the issue allows either; the reader is the smaller change and lets
  the app refuse the file at upload with a reason.
- Family is the typographic family (name ID 16), falling back to name ID 1, the name a CSS `font-family` wants.
- Weight: a `wght` axis in `fvar` makes the file variable (`min`-`max`); otherwise `OS/2 usWeightClass`. Style:
  italic when `OS/2 fsSelection` bit 0 or `head macStyle` bit 1 is set.
- Cover usable only for a static `.ttf`/`.otf`/`.woff` whose weight is one of 100-900 in steps of 100 and whose
  character map Satori reads, the same rules `loadOgFonts` applies. Draft usable for `.ttf`/`.otf` with a family
  name (what libass reads). Captions usable for every readable format (the browser render takes all four).
- Reasons are codes (`format`, `variable`, `weight`, `character-map`, `family-name`) so the app words them in its
  own language; the English `detail` is for logs.
- Changelog under `## Unreleased`; the version is bumped by the batched marketing-kit release (#1170, #1172,
  #1173, #1174).

## Notes
- research skipped: the font tables are standard (OpenType and WOFF2 specs) and the kit already parses `cmap` and
  `name`; no new dependency.
- `og/photo-cover.ts` is not touched, so this does not overlap #1172.

## Done
`readFontFileInfo` and `findMissingCharacters` exported from `.` and `./og`; `readCharacterMap` reads WOFF2. README
(Fonts) and CHANGELOG `## Unreleased`; ships in the batched marketing-kit release with #1170, #1172 and #1173.
