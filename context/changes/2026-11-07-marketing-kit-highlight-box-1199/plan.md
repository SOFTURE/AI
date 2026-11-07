---
change_id: marketing-kit-highlight-box-1199
status: done
---

# Plan: highlight box and boxed cover accent (issue #1199)

Input: change.md, research.md. Complexity: medium.

## Phase 1: colours and contrast

- `config/colors.ts`: `OPTIONAL_COLOR_ROLES = ["captionHighlightBox", "captionHighlightText"]`; `BrandColors` gains
  them as optional keys; `getContrastRatio(a, b)` (WCAG, opaque) moves here from the cover.
- `config/brand.ts`: an optional role takes its inline colour, else its token when the source has it; a token named
  in `tokensFrom.roles` that the source lacks is an issue; otherwise it stays unset.
- `config/schema.ts`: both roles in `brand.colors` and `tokensFrom.roles`; footage `captionHighlightStyle`.

## Phase 2: the film

- `footage/film.ts`: `CAPTION_HIGHLIGHT_STYLES`, `FootageFilm.captionHighlightStyle`.
- `footage/caption-highlight.ts`: `getCaptionHighlight(film, colors)` resolves the look (an error when `box` lacks a
  colour) and `getCaptionHighlightContrast(colors)` returns the lit text on its box and the box on the pill.
- Render (`compose.ts`): in `box` style each word span holds an `<i class="hl">` box (inset `0 -.15em`, radius 12 px,
  opacity 0) behind its text; the word's box fades in and its text turns `captionHighlightText` at the word's start,
  both go back after 0.32 s, as the text style's timing.
- Draft (`draft.ts`): `box` style writes three layers per piece: the pill (text hidden), the lit word's box
  (`\bord` = 0.15 em), the text with the lit word in `captionHighlightText`.
- Pipeline: render and draft refuse a `box` film without both colours (input error).

## Phase 3: cover

- `og/photo-cover.ts`: `accentStyle: "text" | "box" | "auto"` (default `text`). `box` on `kicker-title`: the kicker on
  an opaque accent box, its text the better of the light and dark colour, refused under 3:1 with the reason; `auto`:
  text when it reads, else box. `pill` is a box already. The result reports `accent: { style, contrast }`.

## Phase 4: tests (written first)

- ASS events of a `box` film: the three layers at a known word time; `text` events unchanged.
- Composition: the box element and its tweens only in `box` style; `text` HTML unchanged.
- A draft frame grab (ffmpeg + libass, local): the box colour behind the lit word only.
- Brand colour resolution of the optional roles; the contrast function; the cover's boxed kicker (box rows in the
  accent), `auto` falling back, refusal reason.

## Phase 5: docs

- README, CHANGELOG `## Unreleased`, schema JSON regenerated.

## Acceptance

- New tests pass, existing ones unchanged; gates typecheck, lint, tests.

## Decisions (auto)

- New roles optional rather than required: no existing brand breaks.
- Box inset `0 -.15em`: the span's line box already gives the vertical room; the layout never moves.
- Box radius 12 px (a little over half the pill's 22 px at the pill's padding), a constant.
- `captionHighlightStyle` without `captionStyle: "highlight"` is ignored (nothing is lit).
- Cover `auto` added so the app can ask for "box only when needed".

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
- [x] Phase 4
- [x] Phase 5
