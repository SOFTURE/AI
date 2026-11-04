---
change_id: marketing-kit-footage-draft-1018
status: planned
---

# Plan: a fast ffmpeg draft of a footage film (issue #1018)

Input: change.md, research.md. Complexity: medium (one new module, small edits in shared files).

## Phase 1: draft builders

Files: `src/footage/draft.ts` (new), `src/footage/draft.test.ts` (new), `src/footage/captions.ts`,
`src/footage/compose.ts`, `fonts/` (new: the subset font and its licence), `package.json` (`files`).

- `getFootageDraftFrame(frame, width)`: the draft's frame at `width` (default 540), height even.
- `getCaptionSpans(chunks, cutEnd)` in `captions.ts`: the shown span of each caption chunk; `composeFootage` uses it
  too, so the draft and the render time captions alike.
- `buildFootageDraftCaptions({ film, words, edl, caption, frame, font })`: the ASS text of the phrase captions, or
  null when the film has no captions or no words.
- `buildFootageDraftArgs({ film, edl, clips, speech, frame, width, captions, fontsDir, output })`: per-segment seeked
  inputs, zoom crops at `getSegmentScales`, `zoompan` for `kenburns`, `xfade` for `fade` (offset = the segment's
  start, duration = the film's fade clamped to the segment), `concat` for the other cuts, `ass` captions, the speech
  track, `-t` the cut's length, H.264 yuv420p (veryfast, CRF 28), AAC, `+faststart`.
- `FOOTAGE_DRAFT_FONT` (family and file) for the shipped font.

## Phase 2: run it, machine check, exports

Files: `src/footage/draft.ts`, `src/footage/process.ts` (`cwd` for `runFfmpeg`), `src/footage/tools.ts`,
`src/footage/providers.ts` (`draft` stage), `src/footage/pipeline.ts` (shared caption layout), `src/index.ts`.

- `renderFootageDraft(film, clips, transcript, edl, { buildDir, output, width?, layout?, log, signal?, onProgress? })`
  writes `<buildDir>/draft/` (speech, captions, font), runs ffmpeg there, reports `draft` progress and answers
  `{ output, seconds, width, height }`.
- `getFootageCaptionLayout(film, layout?)`: the caption box the render uses (preset unless overridden); the render
  and the draft share it.
- `checkFootageTools({ needsDraft: true })` reports a missing `ass`, `xfade` or `zoompan` filter.
- A test renders a real draft from generated clips when ffmpeg with `ass` is on the machine and checks its length,
  size and codecs.

## Phase 3: docs

- README "A fast draft before the render", CHANGELOG `## Unreleased`.

## Decisions (auto)

- The draft always draws plain phrases, also for a `highlight` film (the issue asks for phrases; the pill is the
  render's).
- No loudness pass, music, end card, cover or whoosh in the draft (the issue leaves them for later).
- The font is a 48 KB subset of DejaVu Sans Bold shipped in the package, with its licence; brand fonts are the
  render's.
- ffmpeg runs in the draft folder with relative caption and font names, so no path needs filter escaping.
- A fade is clamped to the incoming segment's length, so `xfade` never outlasts its input.
- `checkFootageTools` keeps its default behaviour; the draft check is opt-in (`needsDraft`).

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
