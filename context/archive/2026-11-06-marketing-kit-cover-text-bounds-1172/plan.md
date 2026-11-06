# Plan: marketing-kit-cover-text-bounds-1172

## Progress
- [x] 1. `layOutText` returns the full measured box; `renderPhotoCover` answers `textBox` (right/bottom excluded) and
      `focusPoint`; `CoverBox` and `CoverPoint` types.
- [x] 2. `isPointUnderCoverText(cover, point, marginPx = 0)`; exported from `og` and the root.
- [x] 3. Tests: a known caption's drawn rows are inside `textBox` and the pixels outside it above the scrim equal a
      `photo` render; `textBox` null for `photo`; `focusPoint` equals `getCoverCrop` applied to the focus for a
      portrait, a landscape, an EXIF-rotated photo and a focus near an edge; the helper's inside, margin, edge
      (right/bottom excluded), null box and bad margin cases.
- [x] 4. README and CHANGELOG `## Unreleased`.
- [x] 5. Gates: marketing-kit tests, repository tests, typecheck, lint.

## Evidence
Each step is settled by the tests in step 3 and the gate run in step 5; nothing is manual.

Recorded: `npx vitest run tools/marketing-kit tests/repo` green (photo cover 61 tests), `npm run typecheck` green,
ESLint on the changed files and `npm run lint:language` green.
