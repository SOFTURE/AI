---
change_id: marketing-kit-photo-cover-1137
title: "marketing-kit: a vertical video cover from a photo, with an optional caption (issue #1137)"
status: archived
roadmap_item: null
issue: 1137
branch: claude/project-thread-xbnpsl
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close [issue #1137](https://github.com/SOFTURE/AI/issues/1137): an adopting app wants the cover of a vertical video
to come from a photo the owner picks, not a frame of the film. The kit gets a function that renders a publish-ready
cover JPEG from a photo (path or bytes), cropped to cover the frame around a focus point, EXIF orientation respected,
with an optional short caption in the brand's display font, kept inside the centre 4:5 band.

## Context

Labels: `pkg: marketing-kit`. Builds on the `og` renderer (satori + resvg, brand fonts, glyph check) and sits next to
the frame-grab cover (`buildCoverArgs`, #899). Adds one small runtime dependency (`jpeg-js`, a pure JavaScript JPEG
encoder) because resvg only writes PNG.

## Constraints

- Deterministic, no network, no system fonts, no Playwright import (the `og` entry point stays route-safe).
- Errors are values (`OgResult`), as in `buildOgTree`: an overlong caption and a missing glyph are errors, not drawn.

## Notes

- Framing: skipped. The issue states the need, the input, the output and the acceptance.

## Done

`renderPhotoCover` draws a vertical video cover (1080×1920 by default) from a JPEG or PNG: cover-cropped around a
focus point with EXIF orientation applied, an optional caption in the brand's heading font over a soft scrim in the
lower half of the centre 4:5 band; an overlong caption and a missing glyph are errors. Returns
`{ jpeg, width, height, bytes }`. New dependency `jpeg-js`. Ships in the next marketing-kit release.
