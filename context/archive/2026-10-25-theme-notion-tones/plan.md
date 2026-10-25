---
change_id: theme-notion-tones
status: archived
---

# Plan: theme-notion tones (issue #720)

Input: change.md, research.md. Complexity: small (one new file, barrel, tests, docs).

## Phase 1: tones

Files: `themes/theme-notion/src/notion/tones.ts`, `src/index.ts`, `tests/notion/tones.test.ts`,
`tests/theme-css.test.ts`, `README.md`, `CHANGELOG.md`.

1. `tones.ts`: `TONES` (the list), `Tone`, `TONE_COLORS`, `TONE_TEXT`, `TONE_FILL`, `TONE_EDGE` as in the issue.
2. Export them from the barrel.
3. Tests: every tone maps to a palette colour or `null`; every class map covers exactly every tone and uses the
   tone's colour (or the documented default); the compiled theme CSS contains the tone utilities.
4. README section on tones; CHANGELOG `Unreleased` entry with the migration for an app.

## Decisions (auto)

- One file `tones.ts` instead of the issue's `tones.ts` + `tone-classes.ts`: the vocabulary and its class maps are
  read together, and the file stays short.
- Also export `TONES` (the list), like `PALETTE_COLORS`, so tests and apps can iterate the tones.

## Progress

- [x] Phase 1: tones (d741f02)
