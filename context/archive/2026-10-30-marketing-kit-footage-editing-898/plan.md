---
change_id: marketing-kit-footage-editing-898
status: archived
---

# Plan: natural editing for footage films (issue #898)

Input: change.md, research.md. Complexity: large (several modules, all additive or with v1 compatibility).

## Phase 1: sentences and retakes

`src/footage/sentences.ts`: `splitSentences(words, clip)` / `splitFilmSentences(clips)` (ids `s1`… in film order,
split at `.?!…` or a pause over 1 s), `findRetakes(sentences)` → `{ sentence, kind: "retake" | "false-start" |
"cut-off", of?, reason }`. `buildEdl` takes `keepSentences` (words of other sentences are cut like fillers).

## Phase 2: EDL v2

`edl.ts`: `version: 2`, segment `id` (`s<n>` from the first sentence, `r<n>` b-roll, `w<n>` a talk clip without
words, `.2` on repeats), `audio?: { clip, start, end, ownVolume }`; v1 read and upgraded; `validateEdl` (ids, sound
span, lengths; `findEdlProblems` kept as its alias); `diffEdl(a, b)`; `getEdlJsonSchema()` and
`schema/edl.schema.json`; `remapWords` and `buildSpeechArgs` follow `audio`; video-music cache key without ids.

## Phase 3: quiet look

`FootageFilm.edit?: { zoomPercent (105–110, 108), fadeFrames (1–30, 10), kenBurnsPercent (0–5, 0), endCardWhoosh
(false) }`; `DEFAULT_TRANSITIONS = { jump: "cut", clip: "cut" }`; `captionStyle?: "phrase" | "highlight"` (default
`phrase`, `phraseChunks` 2–6 words, text with a soft shadow, no per-word tween).

## Phase 4: frames, safe zones, glyphs

`extractFrames(file, { count | everySeconds, width, outDir })` (`frames.ts`); `CAPTION_SAFE_ZONES` and
`captionPreset?: "reels" | "shorts" | "tiktok" | "all"` placing the 9:16 caption box inside the zone;
`findMissingCaptionGlyphs` on the caption and end-card fonts against the transcript, run before the render.

## Phase 5: config, CLI, docs, tests

`marketing.json` footage: `edit`, `captionStyle`, `captionPreset`, transitions defaults; schema files regenerated;
README and CHANGELOG; fixture expectations updated (jump cuts are hard cuts now).

## Decisions (auto)

- Segment ids follow sentences so an agent can say "drop s3"; a hand-made id is any `[A-Za-z0-9._-]+`, unique.
- `keepSentences` is a set; order changes are made in the EDL itself (`diffEdl` reports them).
- Retake detection: the earlier of two sentences of one clip, within three sentences, is a `false-start` when its
  words begin the later one, a `retake` when at least 60 % of the longer one's words match in order (LCS); a
  sentence that ends in a dash or ellipsis, or without a full stop at the end of its clip, is `cut-off`.
- A segment's `audio` replaces its sound; `ownVolume` (0–1, default 0) keeps the picture clip's own sound under it.
- Ken Burns: a segment marked `kenburns` zooms by `kenBurnsPercent`, or 4 % when that is 0 (a hand edit asks for it);
  `buildEdl` marks b-roll only when `kenBurnsPercent > 0`.
- Caption presets are opt-in (`captionPreset`); without one the layout stays as it is. Safe-zone margins are the
  conservative values the platforms' creator guides publish, rounded.
- A missing caption glyph fails the render with the characters and the font, as the OG cards do.

## Progress

- [x] Phase 1: sentences and retakes
- [x] Phase 2: EDL v2
- [x] Phase 3: quiet look
- [x] Phase 4: frames, safe zones, glyphs
- [x] Phase 5: config, CLI, docs, tests
- [x] Implementation review
