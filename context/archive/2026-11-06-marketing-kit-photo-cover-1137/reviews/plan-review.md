---
change_id: marketing-kit-photo-cover-1137
verdict: approved
---

# Plan review (auto)

- Scope matches change.md and the issue: input (photo, size, focus, caption, brand fonts and colours), cover crop with
  EXIF orientation, caption in the 4:5 band with errors for overflow and missing glyphs, JPEG of the exact size with
  its facts. Nothing beyond it.
- The one premise that could have been wrong (resvg applying EXIF itself) was measured: it does not, so the plan
  applies the orientation in the SVG.
- Risk: a new dependency. `jpeg-js` is pure JS with no dependencies and no open advisories; `npm audit` stays at 0.
- Risk: the fit oracle depends on rasterising the caption twice (once to measure); the cost is a transparent
  1080×1920 raster, about 100 ms.
- Risk: the `og` entry must stay free of Playwright; the new modules import only satori, resvg, jpeg-js and zod, and
  `tests/og/imports.test.ts` guards it.
- Approved.
