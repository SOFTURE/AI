---
change_id: marketing-kit-caption-anchor-1026
status: done
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

- [x] Phase 1: the bottom anchor (342c3fe)
- [x] Phase 2: the line limit (7b890a8)
- [x] Phase 3: docs (62cbcdc)

## Decisions (auto)

- `bottom?: number` on `CaptionLayout` rather than an `anchor` enum: `top` keeps its meaning, one new key in the
  override, absent from every table so existing layouts render as before.
- The presets anchor by their foot at the zone's edge (`top` kept as the two-line value for readers of it).
- `captionMaxLines` applies to both caption styles; absent means no limit, so nothing changes by default.
- `captionChunks` bounds as film options are not taken: the anchor and the limit hold the foot in place.

## Verification

- `vitest run tools/marketing-kit`: 63 files, 924 tests green (4 skipped need hyperframes/ffmpeg tools).
- `tests/caption-fit.test.ts` in Chromium: a four-word card at 58 px in a 780 px box wraps to 3 lines without a limit
  and fits 2 with `captionMaxLines: 2` (font between 41 and 57 px); its foot stays at y 1500 both times.
- typecheck, ESLint and the language gate green in the pre-commit hook; `schema/marketing.schema.json` regenerated.
