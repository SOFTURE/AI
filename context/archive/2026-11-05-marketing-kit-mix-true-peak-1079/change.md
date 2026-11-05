---
change_id: marketing-kit-mix-true-peak-1079
title: "marketing-kit: the finished footage MP4 holds mixLoudness's true peak, measured and gated (issue #1079)"
status: archived
roadmap_item: null
issue: 1079
branch: claude/project-thread-l7iehd
created: 2026-11-05
updated: 2026-11-05
archived_at: 2026-11-05
---

## Intent

Close [issue #1079](https://github.com/SOFTURE/AI/issues/1079): `finishFootage` normalizes the mix with `loudnorm`
at `mixLoudness` (-14 LUFS, -1 dBTP), but the AAC encode after it adds 0.7-1.1 dB of inter-sample overshoot, so the
finished MP4 measures up to +0.9 dBTP while the log claims -1 dBTP. Nothing measures the written file.

## Context

Found in an adopting app's production render (54 s film with music: -14.8 LUFS, +0.1 dBTP). No version bump: the
coordinator does one combined release. A parallel change (#1077, captions) touches `pipeline.ts`, `index.ts` and the
CHANGELOG; the second to merge resolves the conflict.

## Scope

- The mix's final stage is gain plus a true-peak limiter (4x oversampled), encoded to AAC on its own, measured, and
  re-run with a lower ceiling (bounded retries) when the encoded true peak is over; the final pass muxes it with
  `-c:a copy`.
- A gate on the finished MP4: true peak <= `mixLoudness.truePeak` and integrated = `mixLoudness.target` +/- 1 LU,
  else `err(...)` naming both measurements.
- `FinishedFootage.loudness` (`{ integrated, truePeak }` of the finished file, null without sound or for a silent
  mix); the log states the measured values.
- Tests with loud percussive music, and a forced failure.

## Constraints

- `mixLoudness: null` keeps the mix as rendered (no gain, no limiter, no gate); a silent mix is left as it is.
- The speech track's own pass (`loudness`, `normalizeLoudness`) is unchanged. Exported `getLoudnessFilter` stays.

## Notes

- Framing: skipped. The issue states the problem, the measurements and the acceptance.

## Done

The mix's last stage is gain plus a 4x oversampled true peak limiter, encoded to AAC on its own, measured and
re-encoded with a lower ceiling (at most 4 times) while it misses the target; the final pass muxes it with
`-c:a copy`. The finished MP4 is measured and gated (`err` naming both values); `FinishedFootage.loudness` carries the
measurement and the log states it. Tests in `tools/marketing-kit/src/footage/{loudness,publish,finish}.test.ts`;
CHANGELOG `## Unreleased`, README. Ships with the next marketing-kit release.
