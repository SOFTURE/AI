# Research: marketing-kit-cover-text-bounds-1172

- `tools/marketing-kit/src/og/photo-cover.ts`: `layOutText` renders the text alone and measures it with `findDrawnBox`
  (inclusive `bottom` and `right`, alpha above `DRAWN_ALPHA`), then checks it against `getRegionRows`. It returns only
  `top` and `bottom`, which `buildScrim` reads. The full box is already computed; it just is not passed on.
- `tools/marketing-kit/src/og/photo.ts` `getCoverCrop(orientedSize, frame, focus)` gives `{ scale, x, y }`: the upright
  photo is drawn at `translate(x y) scale(scale)`, so the focus lands at `x + focus.x * width * scale`,
  `y + focus.y * height * scale`, clamped by the crop (the photo's edge can stop the shift).
- Exports: `src/og/index.ts` and the root `src/index.ts` list the photo cover names explicitly.
- CHANGELOG convention: unreleased entries go under `## Unreleased`; the release PR renames it.
