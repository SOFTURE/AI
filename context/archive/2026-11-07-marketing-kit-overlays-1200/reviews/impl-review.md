---
change_id: marketing-kit-overlays-1200
verdict: approved
---

# Implementation review (auto)

- #1200 covered: `overlays` in the EDL v2 (`punch_in`, `keyword`, `lower_third`, `list`, `arrow`, `highlight`),
  timed by `at_word` or `at`, validated by `overlaySchema` and resolved by `resolveEdlOverlays` against the cut, the
  segments, the caption band and the safe zone (word not found, past the cut, across a cut, overlap,
  `overlayMinSpacing`, card does not fit, anchor outside the zone or on the captions, punch-in on a Ken Burns segment).
- Render: HTML, CSS and GSAP tweens adapted from HyperFrames registry blocks (credited in `NOTICE`); the punch-in
  zooms the picture. Draft: libass cards, drawings and the zoom in `buildPictureFilters`.
- Evidence: `src/footage/overlays.test.ts` (schema, guards, composition, ASS, zoompan, libass frame grabs);
  `tests/overlays-render.test.ts` (Chromium frame grabs on the composition's own timeline); `tests/render.test.ts`
  (opt-in real render on hyperframes 0.9.20: the keyword card changes its region, a far patch stays unchanged; passed
  locally).
- Compatibility: a composition and a draft without overlays are byte-identical to before. hyperframes 0.9.6 to
  0.9.20 keeps the dependency tree, the render flags and the capture summary; `npm ci` reports 0 vulnerabilities.
- No external service in any test.
