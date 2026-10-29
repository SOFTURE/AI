---
change_id: marketing-kit-footage-films-886
verdict: approved
---

# Implementation review

Reviewed the diff from 911b0d1 against plan.md and issue #886.

- Blocks of the issue, each a library export: `probeFootage` (duration, size, rotation from the display matrix or the
  `rotate` tag, codec, transfer, PQ / HLG / Dolby Vision, sound), `normalizeFootage` (frame of the format at 30 fps,
  upright, HDR tone-mapped with zscale + Hable, crop or blur fill, 48 kHz stereo, silence for a mute clip), the
  speech-to-text, isolation and music providers (ElevenLabs and fakes), `buildEdl` (fillers per language, pauses,
  padding, max length, transitions by kind of cut), captions through `remapWords`, transitions and Ken Burns in
  `composeFootage`, ducking keyframes applied by ffmpeg, the hyperframes render and `posts.md`.
- `renderFootageFilm(film, options)` builds a film from a `FootageFilm` object; the CLI maps `footage[]` onto it and
  runs the steps alone with `--step=transcribe|cut|render`; the EDL is a plain JSON file, reused when present and
  checked against the clips when read.
- Money: every provider call sits behind `isCommit`; a dry run lists each paid call with its seconds and sends
  nothing (unit test and the render test's dry run); paid results are cached by content and settings.
- `--placeholder`: transcripts from each clip's script, no isolation or generated music, its own EDL and
  `.placeholder.mp4`, nothing in the paid cache (unit test and render test).
- Screen film untouched: only `escapeHtml`, `fontFaces` and `fontStack` moved to `compose/html.ts` and `copyFonts`
  became exported; the existing composition tests pass unchanged.
- Tests: probe, normalize arguments, EDL, music, ElevenLabs requests and parsing, fakes, composition, render
  arguments, pipeline dry run and placeholder, config and CLI options; the opt-in render test generates three CC0
  clips (rotated portrait with sound, landscape b-roll, HLG HDR), checks the probe, the dry run and the rendered
  1080×1920 film with sound, the cut filler and the post copy. Run locally: green (83 s).
- Docs: README "Footage films" and "Footage films from code", limitations, CHANGELOG `## Unreleased`, docs/03.

Verdict: approved, no changes.
