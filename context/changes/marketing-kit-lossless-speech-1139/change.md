---
change_id: marketing-kit-lossless-speech-1139
title: "marketing-kit: a lossless, pre-gained speech chain (issue #1139)"
status: in_progress
roadmap_item: null
issue: 1139
branch: claude/project-thread-c9vt2l
created: 2026-11-06
updated: 2026-11-06
---

## Intent

Close [issue #1139](https://github.com/SOFTURE/AI/issues/1139): the footage speech chain encodes quiet speech to MP3
(and the clip's sound to AAC) several times before the loudness pass adds about +20 dB, so the encoders' artefacts
surface after the gain. Keep every intermediate speech file lossless, pre-gain each clip's sound to about -23 LUFS
right where it is extracted, hand the Voice Isolator that lossless, pre-gained sound, and leave the final AAC as the
only lossy encode, its bitrate an option (default 192 kbps, 48 kHz).

## Context

Labels: `pkg: marketing-kit`. A parallel thread carries #1143 (the draft's loudness pass) and owns `draft.ts`; point 4
of #1139 (the same chain in `renderFootageDraft`) is covered there: the draft takes its speech map from
`transcribeFootage` and its file names from `getSpeechChainFiles`, which this change makes lossless. Signatures of
`getSpeechChainFiles` and `mixFootage` stay. No version bump: one combined marketing-kit release follows.

## Constraints

- No paid call is repeated: the isolation and transcript cache keys stay; a cached cleaned voice is reused as it is.
- The speech track keeps its timing exactly (the lossless sound is cut from the same seek and length as the clip).
- The mix still passes its loudness verdict.

## Notes

- Framing: skipped. The issue names the cause, the fix and the acceptance checks.
