---
change_id: clip-sound-one-sided-channel
title: "marketing-kit: fold a clip whose sound lives in one channel onto both"
status: archived
archived_at: 2026-11-19
roadmap_item: null
issue: 1385
branch: claude/kit-one-sided-channel-fold
created: 2026-11-19
updated: 2026-11-19
---

## Intent

A clip whose voice was recorded in one channel only (a wireless lavalier receiver in stereo mode with one
transmitter) plays in both ears in the draft and the finished film, not only in the left one (#1385).

## Context

`prepareClipSounds` brings every clip's sound to 48 kHz stereo with `aformat`, which keeps a stereo source's channels
as they are. An adopting app's clips measure -20.5 dB RMS left and -116.6 dB right; its speech chain WAV and its draft
keep the voice on the left only. Every later stage (isolation, transcript, speech track, draft, render) reads the
speech chain WAV, so the fold belongs there.

## Scope

- `tools/marketing-kit/src/footage/clip-sound.ts`: a per-channel measure, the one-sided rule, the fold in the
  measuring and the extraction arguments, the fold on `ClipSound` and in the log.
- Tests in `clip-sound.test.ts`; README and CHANGELOG lines; a patch release.

## Constraints

- A balanced stereo clip, a mono clip and silence come out byte for byte as before (same arguments).
- The pre-gain is measured after the fold.

## Notes

- Frame skipped: the cause is measured (dead right channel in the source, carried through), the fix is local.

## Decisions (auto)

- One-sided when the quieter channel is under -70 dBFS RMS and at least 30 dB under the other: the measured dead
  channel sits near -116 dB; real stereo of a phone stays within a few dB.
- Fold by copying the live channel (`pan=stereo|c0=c0|c1=c0`), not by summing: summing a dead channel only adds its
  noise and halves the level.
- Detection over a separate `astats` pass rather than a fixed mono downmix of every talking clip: genuine stereo
  (b-roll ambience) keeps its width.

## Done

- `prepareClipSounds` folds a one-sided clip onto both channels before measuring and extracting; released as a patch
  of `@softure-ai/marketing-kit` after the merge.
