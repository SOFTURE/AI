# Plan: footage-logo-end-card

## Progress
- [x] 1. Types and length: `FootageEndCard` union (`full` with `seconds`, `logo` with `line`, `logo`, `seconds`,
  `fadeSeconds`), `getEndCardSeconds`; `getFootageFilmSeconds`, paid estimate and dry run follow it (unit tests).
- [x] 2. Composition: full card tweens scaled to its length; logo card HTML/CSS in the safe zone, fade in, no upscale;
  pop skipped past the end (compose tests).
- [x] 3. Sound: `buildMusicArgs` takes the fade-out length; the pipeline fades over the logo card (render test).
- [x] 4. Pipeline: the card's logo copied with its own extension; the glyph check covers the line (pipeline/captions tests).
- [x] 5. Config: schema union, `seconds`, `logo` path resolved and checked for existence (config tests).
- [x] 6. README, CHANGELOG (unreleased minor), exports; gates: typecheck, lint, marketing-kit tests; a local render of
  the composition in Chromium at 1080x1920 looked at as a frame grab.

Evidence: `npx vitest run tools/marketing-kit tests/repo` 2121 passed, 134 skipped (ffmpeg-gated); `npm run typecheck`
clean; ESLint on the changed files and `npm run lint:language` clean (the whole-tree `eslint .` runs out of memory in
this container; CI runs it). The logo card composed with a 480x240 PNG and a Polish line, seeked in Chromium at
1080x1920: at 0.1 s half faded over the last frame, at 0.5 s solid brand background, the PNG at its own size, the
line sharp, all inside the reels safe zone.
