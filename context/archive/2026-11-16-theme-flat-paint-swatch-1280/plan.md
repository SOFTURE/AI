---
change_id: theme-flat-paint-swatch-1280
status: archived
---

# Plan: theme-flat-paint swatch orientation (issue #1280)

Input: change.md. Complexity: trivial (one class string).

## Phase 1: swap the swatch size (TDD)

Files: `themes/theme-flat-paint/tests/index.test.ts`, `src/look/color-field.ts`, `CHANGELOG.md`.

- Test first: `COLOR_FIELD_LOOK.swatch` is `"w-9 h-7 border-line-strong bg-surface-raised"`, and a test that the
  compiled theme CSS has `.w-9` and `.h-7` (the classes are generated).
- Then the look map and its doc comment (36 × 28 px, width × height).
- CHANGELOG `## Unreleased`: the picker is 36 px wide and 28 px tall, as in the source app; an app that relied on the
  tall picker passes its own `swatch` class.

## Decisions (auto)

- The source app's orientation wins (the issue's ask): the look maps exist to reproduce that app.
- Patch-level change (a visual fix); no version bump, the coordinator releases the batch.

## Progress

- [x] Phase 1: 66a0528 (`npx vitest run themes/theme-flat-paint`: 84 passed, 4 skipped; the swatch test failed before the fix)
