---
change_id: marketing-kit-caption-anchor-1026
status: in_progress
---

# Plan: captions anchored by their foot and fitted to a line limit (issue #1026)

Input: change.md, research.md (options 1, 2, 3). Complexity: medium.

## Phase 1: the bottom anchor (TDD)

Files: `src/compose/timeline.ts`, `src/compose/compose.ts`, `src/footage/{captions,compose,draft}.ts`,
`src/config/schema.ts`, tests.

- `CaptionLayout.bottom?: number`; `resolveLayout` takes it from the override; `getCaptionPositionCss` returns
  `top:Npx` or `bottom:Npx`; both compositions use it. Exported `CAPTION_LINE_HEIGHT` (1.18) and
  `CAPTION_PILL_PADDING` (`{ y: 16, x: 28 }`) drive the CSS.
- Override schema: `bottom` (0..frame height).
- `getCaptionPresetLayout` adds `bottom: zone.bottom` (`top` stays the two-line value for readers of it).
- Draft: with `bottom`, ASS alignment 2 and `MarginV = bottom`.
- Tests: resolveLayout merge, both CSS outputs, preset layout, draft style line, override schema.

## Phase 2: the line limit (TDD)

Files: `src/footage/{film,compose}.ts`, `src/config/{schema,config}.ts`, tests.

- `FootageFilm.captionMaxLines?: number`; schema `captionMaxLines` int 1-4, optional; config passes it through.
- `composeFootage` with a limit adds a script before the timeline that fits each `.caption > p` (now and on
  `document.fonts.ready`): font size down in 1 px steps to `CAPTION_MIN_FONT_SCALE` (0.7) of the box's size until the
  text box has at most N lines.
- Tests: no script without a limit; the script with the limit and floor; a Chromium test (runs where Chromium is) that
  a long two-word Polish card at 58 px in a 780 px box fits two lines and keeps its foot at the anchor.

## Phase 3: docs

README (caption box, presets, `captionMaxLines`), CHANGELOG `## Unreleased`, regenerated `schema/marketing.schema.json`.

## Progress

- [ ] Phase 1: the bottom anchor
- [ ] Phase 2: the line limit
- [ ] Phase 3: docs
