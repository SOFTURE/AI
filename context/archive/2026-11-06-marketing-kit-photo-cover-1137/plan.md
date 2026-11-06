---
change_id: marketing-kit-photo-cover-1137
status: done
---

# Plan: a photo cover for vertical video (issue #1137)

Input: change.md, research.md. Complexity: small to medium (one new module, one dependency).

## Phase 1: reading the photo (`src/og/photo.ts`)

- `readPhotoInfo(bytes)`: `{ format: "jpeg" | "png", width, height, orientation }` or an error naming what is wrong.
- `getOrientationMatrix(orientation, width, height)` and `getCoverCrop({ width, height }, size, focus)`: pure.

## Phase 2: the cover (`src/og/photo-cover.ts`, exported from `./og` and the root)

- `renderPhotoCover(input)`: input checked with zod (photo path or Buffer, `size` default 1080×1920, `focus`
  default 0.5/0.5 in 0..1, `caption` trimmed 1..80 characters, `quality` 1..100 default 90, `colors`, `fonts`, `id`).
- The caption tree (heading font, weight 700, size by length, centred, text-shadow) checked for glyphs, rendered by
  satori, rasterised alone and measured against the band; overflow is an error.
- The composite SVG rasterised by resvg; RGBA encoded with `jpeg-js`. Returns `{ jpeg, width, height, bytes }`.
- `getCoverBand(size)`: the centre 4:5 band, exported for callers that place their own overlays.

## Phase 3: tests and docs

- `tests/og/photo-cover.test.ts`: a landscape and a portrait photo come out exactly 1080×1920 and crop around the
  focus point (decoded pixels); EXIF orientation 6 and 3 are honoured; a PNG works; no caption gives the photo alone
  (no scrim); a caption paints only inside the band in the brand font (pixel oracle); an overlong caption and a
  missing glyph are errors; an unreadable path and a non-image are errors; invalid focus is an error.
- `src/og/photo.test.ts`-style unit tests for the header parsing and crop maths (in `tests/og/`).
- README section, CHANGELOG `## Unreleased`.

## Acceptance

- The issue's three acceptance points, each a test above. Gates: typecheck, lint, `npm test`.

## Decisions (auto)

- A function, not an `og` template: a template's data is JSON and cannot carry a photo; the function reuses the
  renderer's fonts, glyph check and result type.
- `jpeg-js` for the encode (pure JS, deterministic, small) over sharp (native binaries, much larger).
- Caption fit is measured on pixels rather than estimated from characters, so any display font is held to the band.
- The caption sits in the lower part of the band, centred; the scrim fades from clear to the dark brand colour at
  about 55 % opacity at the band's lower edge and stays to the frame's bottom (the platforms' own UI sits there).

## Progress

- [x] Phase 1: `src/og/photo.ts`: `readPhotoInfo` (JPEG SOFn + APP1 Exif, PNG IHDR + eXIf), `readTiffOrientation`,
  `getOrientedSize`, `getOrientationMatrix`, `getCoverCrop`.
- [x] Phase 2: `src/og/photo-cover.ts`: `renderPhotoCover`, `getCoverBand`, `getCoverCaptionSize`; exported from
  `./og` and the root. `jpeg-js` ^0.4.4 added (npm audit: 0).
- [x] Phase 3: `tests/og/photo-cover.test.ts` (28 pass). Replacing the orientation with identity fails the four
  orientation tests (checked). Visual check: a 1600×1000 test photo with a 30-character caption at 1080×1920 looked
  at as a JPEG: caption centred in the lower band, scrim soft, no sticker. README "A video cover from a photo",
  licences table, CHANGELOG `## Unreleased`. Gates: typecheck, ESLint on the changed files, language gate, the
  package's tests (452 pass).
- Decision during implementation: the caption keeps to the lower half of the 4:5 band (not the whole band), so the
  subject above stays clear and the measured fit check can actually refuse a too-long caption in an ordinary font
  (80 × "W" at 1080×1920 is refused).
