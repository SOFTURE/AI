---
change_id: marketing-kit-speech-pre-gain-report-1181
title: "marketing-kit: the speech pre-gain says when the peak ceiling held it, and can reach the target (issue #1181)"
status: archived
roadmap_item: null
issue: 1181
branch: claude/project-thread-mi3v1e
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close [issue #1181](https://github.com/SOFTURE/AI/issues/1181): `prepareClipSounds` stops the speech pre-gain at the
-3 dBTP peak ceiling on quiet speech with a few short peaks, so the speech chain hears it around -26 to -28 LUFS
instead of -23, and nothing says so. The kit must report what the pre-gain reached (and why it stopped), and offer an
opt-in way to reach the target without clipping and without any dynamics on speech.

## Context

Labels: `pkg: marketing-kit`. Builds on #1139 (lossless pre-gained clip sound) and #1159 (range gain records).

## Constraints

- Additive API only (minor release): `ClipSound.gainDb`, `speechGainDb` stay.
- The pre-gain stays one linear gain: no limiter, no gate, no compressor on speech.
- No test talks to an external service.

## Notes

- Framing: skipped. The issue names the problem, the measurement and the acceptable fixes.

## Done

`ClipSound.preGain`, `IsolatedSpeech.speechPreGain` and `TranscribeOutcome.speechPreGain` say whether the pre-gain
reached -23 LUFS or the -3 dBTP ceiling held it (with the measurement before and after), and the log names every held
clip. The opt-in `speechPeaks: "float"` reaches the target by the same linear gain and writes the clip sound as 32-bit
float. Ships in the next combined marketing-kit release.
