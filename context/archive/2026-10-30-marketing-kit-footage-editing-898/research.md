---
change_id: marketing-kit-footage-editing-898
status: done
---

# Research: natural editing for footage films (issue #898)

Read on the branch with #899 (25e6171).

- `edl.ts`: `buildEdl` splits talk words into runs at fillers and pauses (`getTalkSpans`), b-roll whole with
  `motion: "kenburns"`; segments `{ clip, start, end, transition, motion }`, `version: 1`, no ids. `findEdlProblems`
  checks film, clip, range, length. `remapWords` maps words by the segment's own clip.
- `compose.ts`: one `<video>` per segment (muted; sound is the speech track), `FADE_SECONDS = 0.35`,
  `ZOOM_SCALE = 1.12`, `KEN_BURNS_SCALE = 1.08`, captions from `captionChunks` as a pill with per-word colour
  tweens, the end card always plays a whoosh and a pop.
- `render.ts` `buildSpeechArgs` takes each segment's sound from its own clip's span; the music is ducked from the
  remapped words, so words must follow the sound once a segment's sound comes from elsewhere.
- `paid.ts` keys video-scored music on `edl.segments` as they are: adding `id` would change the key and buy the
  music again, so the key keeps the v1 fields.
- `film.ts` `DEFAULT_TRANSITIONS = { jump: "zoom", clip: "fade" }`; `schema.ts` repeats these defaults.
- `og/glyphs.ts` `findMissingGlyphs(tree, SatoriFont[])` works on an element tree with Satori's font choice; caption
  text is one family per text, so a tree of `{ fontFamily, text }` nodes reuses it. `og/fonts.ts` loads fonts.
- Layout 9:16 caption box `top: 1470` (bottom margin ~300 px), inside Reels' but not TikTok's bottom UI.
- zod 4 `z.toJSONSchema` already produces `schema/marketing.schema.json` (`scripts/write-schema.ts`, test
  `tests/schema.test.ts` keeps it fresh); the EDL schema can follow the same path.
