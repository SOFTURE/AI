---
change_id: marketing-kit-isolate-speech-ranges-1087
title: "marketing-kit: isolate a footage film's voice per time range with a range cache (issue #1087)"
status: archived
roadmap_item: null
issue: 1087
branch: claude/project-thread-j0hniq
created: 2026-11-05
updated: 2026-11-05
archived_at: 2026-11-05
---

## Intent

Close [issue #1087](https://github.com/SOFTURE/AI/issues/1087): `transcribeFootage` isolates a talking clip's voice
only whole, so an app that wants the Voice Isolator only on the parts the cut keeps (about 40 % of the cost for a
54 s reel cut from 1.5 min) composes the kit's primitives itself. Add a footage block that isolates the cut's sound
ranges (with a margin, clamped to the clip), caches each range by clip identity, range in milliseconds and provider,
lays the cleaned windows back over the clip's own sound into one file per clip (the speech map the render takes),
and estimates the uncached ranges for a confirmation step. Without `isCommit` only cached ranges are laid.

## Context

Labels: `enhancement`, `pkg: marketing-kit`. Parallel marketing-kit work in flight: #1081 (caption chunks), #1084
(declick, PR #1088: the speech track in `render.ts`/`pipeline.ts`/`draft.ts`), #1085 (mix loudness, PR #1090). This
change adds a new module and touches shared files (`paid.ts`, `providers.ts`, `index.ts`, README, CHANGELOG) at small,
separate spots. No version bump: one combined marketing-kit release follows (coordinator).

## Constraints

- The whole-clip path (`film.isolateVoice` in `transcribeFootage`) stays as it is.
- Pure planning (ranges, windows, ffmpeg arguments) is unit tested without ffmpeg; one test runs the block end to end
  with the fake isolation provider when ffmpeg is on the machine.

## Notes

- Framing: skipped. The issue names the gap, the parts of the block and the cache key.

## Done

`isolateSpeechRanges` isolates only the cut's ranges with a per-range cache and lays them back into the speech map;
`estimateSpeechRanges` and `estimateFootageFilm` `isolate: "segments"` price the uncached ranges. Ships in the next
combined marketing-kit release.
