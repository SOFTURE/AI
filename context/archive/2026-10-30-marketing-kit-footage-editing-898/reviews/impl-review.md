---
change_id: marketing-kit-footage-editing-898
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and issue #898.

- Sentences and retakes (`sentences.ts`): ids follow the film's talking clips in order; `findRetakes` only suggests,
  with a reason; `buildEdl` cuts the words of dropped sentences like fillers and drops a clip left without any. The
  CLI prints the suggestions after `--step=cut` and never applies them.
- EDL v2 (`edl.ts`): segment ids from sentences (`s4`, `s4.2`), b-roll (`r1`) and wordless clips (`w1`); `audio`
  with `ownVolume` drives the speech track (`buildSpeechArgs`, amix when the own sound stays), the captions and the
  ducking (`remapWords`). A v1 file reads and is upgraded; its errors are reported against v1. `validateEdl` adds
  repeated ids and the sound span's clip, range and length; `findEdlProblems` stays as an alias. `diffEdl` reports
  drops, additions, moves (by a longest kept order), span, transition and motion changes, and borrowed sound named by
  the segment it comes from. `schema/edl.schema.json` is generated and kept fresh by `tests/schema.test.ts`.
- Money: the scored music's cache key keeps the v1 fields only (test: a v1 file and the same cut with ids share it).
- Look (`film.ts`, `compose.ts`): hard cuts, still b-roll, phrase captions and no end-card whoosh by default;
  `zoomPercent`, `fadeFrames`, `kenBurnsPercent`, `isEndCardWhoosh` and `captionStyle` change them. A segment marked
  `kenburns` by hand still zooms (4 %) when the film sets none.
- Frames (`frames.ts`), safe zones and glyphs (`captions.ts`): `extractFrames` caps a sheet at 120 frames;
  `captionPreset` places the 9:16 box only when the project sets no caption override; the glyph check reads each font
  file's cmap, skips a family it cannot read, and stops the render with the missing letters.
- Tests: unit tests for every new block, updated compose, EDL, speech and config tests, and the fixture render
  (ids, hard cuts) passes locally. Gates: typecheck, ESLint, language gate, marketing-kit tests.

Verdict: approved.
