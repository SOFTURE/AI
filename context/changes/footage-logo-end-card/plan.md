# Plan: footage-logo-end-card

## Progress
- [ ] 1. Types and length: `FootageEndCard` union (`full` with `seconds`, `logo` with `line`, `logo`, `seconds`,
  `fadeSeconds`), `getEndCardSeconds`; `getFootageFilmSeconds`, paid estimate and dry run follow it (unit tests).
- [ ] 2. Composition: full card tweens scaled to its length; logo card HTML/CSS in the safe zone, fade in, no upscale;
  pop skipped past the end (compose tests).
- [ ] 3. Sound: `buildMusicArgs` takes the fade-out length; the pipeline fades over the logo card (render test).
- [ ] 4. Pipeline: the card's logo copied with its own extension; the glyph check covers the line (pipeline/captions tests).
- [ ] 5. Config: schema union, `seconds`, `logo` path resolved and checked for existence (config tests).
- [ ] 6. README, CHANGELOG (unreleased minor), exports; gates: typecheck, lint, marketing-kit tests; a local render of
  the composition in Chromium at 1080x1920 looked at as a frame grab.
