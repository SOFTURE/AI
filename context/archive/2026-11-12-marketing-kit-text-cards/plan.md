# Plan: marketing-kit-text-cards

## Approach

New knobs and kinds on the existing pipeline, each drawn by both renderers from one resolved shape:

- `style.backdrop: "card" | "highlight"` (hook_title, keyword): `highlight` draws each line on its own tight box in
  the card colour, no shadow; with a typed entrance the box grows with the typed letters.
- entrance `drop` (hook_title, keyword, end_word): letters fall into place one by one, `DROP_LETTER_GAP` apart, from
  `DROP_FROM_EM` of the line above with a small turn, eased out, never past their rest (`getDropOffsetAt`). The draft
  shows the same letters appearing on the same times (libass cannot move one letter).
- kind `note` (text up to 72 characters): `note_style: "card"` a tilted paper card with a torn bottom edge, words in
  the Caveat handwriting appearing on their spoken times (matched in order to the film's words inside its span, else
  spaced), the card there one frame before its first word; `note_style: "strip"` a paper strip with a torn top edge
  that grows in over 8 frames (ease-out) and types its text in capitals in the heading font; `tick: true` draws a hand
  tick after the last word. Paper defaults to an off-white and ink to near black; `style.colors` overrides them. At
  most 6 words and 4 lines: a longer note is refused with a reason.
- kind `end_word` (one word or short phrase, up to 16 characters, 0.5 to 2 s): a big handwritten word at the top, no
  card, drop by default. Like a hook title it lives in the top band: not counted against one overlay at a time, but
  nothing else may sit on it, and only one title-band overlay at a time.
- Fonts: `fonts/Caveat-SemiBold-Latin.ttf` (OFL, `LICENSE-Caveat.txt`, README); the draft copies it when a note card
  or an end word is drawn; the render copies it to `assets/fonts/hand.ttf` with its `@font-face`.

## Phases

1. Schema (kinds, entrance, knobs, limits, refusals) + JSON schema. Tests: schema accept/refuse per kind and knob.
2. Resolver: placement, word times, tilt and tear, end word in the title band. Tests: speech-timed reveal, spacing
   fallback, too-long refusals, timing problems.
3. Render: markup, CSS, tweens for highlight, drop, note, strip, tick, end word; hand font face. Tests: markup and
   tween strings; drop offsets never past rest.
4. Draft: ASS events for the same; hand font copied. Tests: events, times; libass frames of each device compared
   with the reported boxes (draft) and the render's boxes.
5. Exports, README, CHANGELOG, minor bump, `tools/deploy` dev range, lockfile.

## Progress

- [x] 1 Schema
- [x] 2 Resolver
- [x] 3 Render
- [x] 4 Draft
- [x] 5 Docs and release prep

## Decisions (auto)

- Handwriting is measured from the font's own advances (`measureHandText`): the generic 0.56 em estimate overstated
  Caveat by about half, so a 16-character end word could never fit. A strip's capitals use 0.76 em (bold capitals
  measured at about 0.72 em in DejaVu Sans Bold, plus letter spacing): with the estimate they ran past their paper in a
  libass frame. The draft scales the hand font's `\\fs` by its (winAscent + winDescent) / unitsPerEm so its letters
  match the render's.
- A dropped, highlighted title shows each line's mark from the start, its letters falling onto it, in the render and
  the draft alike (the mark is the line's background).

- One `note` kind with `note_style` rather than two kinds: the strip is the same paper device in another shape.
- `end_word` is its own kind (not a hook title at the end): it takes a shorter span and a bigger, card-less look.
- The draft's drop is letters appearing on their times without the fall: libass moves whole events only, and the
  draft is the simplified preview the render refines.
