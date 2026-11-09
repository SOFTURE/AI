# Research: marketing-kit-caption-min-words

- Cards are cut in `getFootageCaptionChunks` (`src/footage/captions.ts`), shared by the render (`compose.ts`) and the
  draft (`draft.ts`): `captionChunks` (highlight, max 4 words, ends at `.,?!:;`) or `phraseChunks` (2-6 words, ends at
  punctuation or a 0.7 s pause, a lone word joins the phrase before only when it has room and no pause).
- `captionChunks` has no lower bound at all, so "You know, mate, that is it." gives "You know," and "mate," alone;
  `phraseChunks` leaves a lone word after a full phrase or a pause.
- The app cannot fix it outside the kit: the kit cuts the cards inside the render. A word-joining workaround in the
  app (no-break spaces) would hide the kit's punctuation breaks and is a local workaround the owner forbids.
- The box's width is the app's to know (font, safe zone); the kit takes a character limit for a join, like the app's
  existing 16-character token limit.
