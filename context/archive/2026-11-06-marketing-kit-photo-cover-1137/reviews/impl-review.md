---
change_id: marketing-kit-photo-cover-1137
verdict: approved
---

# Implementation review (auto)

- Scope: the issue's proposal and its three acceptance points are implemented: landscape and portrait photos come out
  exactly 1080×1920 cropped around the focus point; a caption renders in the brand's heading font inside the 4:5
  band, an overlong caption and a missing glyph are errors; no caption draws the cropped photo alone.
- Evidence: decoded output pixels in the tests (crop, orientation 3/6/8 and PNG eXIf, scrim, band); the orientation
  tests fail when the orientation is ignored. The caption fit is measured on drawn pixels, not estimated.
- Correctness: the crop never lets an edge into the frame (clamped offsets, unit-tested at 0, 0.5, 1); a damaged or
  unknown file is an error naming why; input is checked with zod at the boundary; results are values.
- The `og` entry stays free of Playwright (`tests/og/imports.test.ts` passes); the new modules use satori, resvg,
  jpeg-js and zod only.
- Dependency: `jpeg-js` (BSD-3-Clause, pure JS, no dependencies, no advisories); listed in the README's licences.
- Limit noted in the README: ICC profiles are not converted.
- Approved.
