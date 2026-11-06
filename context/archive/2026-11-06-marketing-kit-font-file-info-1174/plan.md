# Plan: marketing-kit-font-file-info-1174

## Progress
- [x] 1. `src/og/font-tables.ts`: read the table directory of sfnt, WOFF (zlib) and WOFF2 (Brotli) files into tagged
  buffers, bounds-checked; collections refused. Tests: real Inter `.woff` and `.woff2`, the shipped DejaVu `.ttf`, a
  synthetic WOFF2, truncated and garbage input.
- [x] 2. `src/og/font-file.ts`: `readFontFileInfo` (family, weight, cssWeight, style, format, per-use verdicts) and
  `findMissingCharacters`. Tests: static and italic Inter files, a synthetic variable font (`fvar` wght 100-900),
  an odd weight (350), broken files return error values; Polish letters missing from a `latin` subset.
- [x] 3. `readCharacterMap` goes through the shared reader, so WOFF2 works; existing glyph tests stay green.
- [x] 4. Exports from `.` and `./og`, README (Fonts), CHANGELOG `## Unreleased`.
- [x] 5. Gates: typecheck, lint (ESLint + language gate), marketing-kit `src` and `tests/og` plus `tests/repo` (1555 passed before the language fix; the font-file, language and package tests green after it).
