---
change_id: marketing-kit-highlight-box-1199
verdict: approved
---

# Implementation review (auto)

- #1199 points 1-7 covered: `captionHighlightStyle` (default `text`), the optional roles `captionHighlightBox` and
  `captionHighlightText` in `brand.colors` and `tokensFrom.roles`, the render's box (absolute child behind the text,
  same timing), the draft's box (three libass layers), `getCaptionHighlightContrast`, the cover's `accentStyle`, tests.
- Evidence: `src/footage/caption-highlight.test.ts` (ASS events, composition, a libass frame grab showing the box
  only behind the lit word and none when unlit); `tests/caption-highlight-box.test.ts` (Chromium frame grab on the
  composition's own GSAP timeline: box within 8-12 px of the lit word's edges, text #111111, gone after the hold, word
  rects identical to the text style); `tests/og/photo-cover.test.ts` (boxed kicker pixels, `auto` fallback, refusals);
  `tests/brand.test.ts` (optional roles).
- Compatibility: a text-style composition is byte-identical to one without the key (test); existing draft and cover
  tests unchanged except the refusal text, which now suggests the box.
- No external service in any test.
