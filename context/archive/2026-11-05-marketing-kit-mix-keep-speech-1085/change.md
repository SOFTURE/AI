---
change_id: marketing-kit-mix-keep-speech-1085
title: "marketing-kit: a mixLoudness mode that keeps the speech level (issue #1085)"
status: archived
roadmap_item: null
issue: 1085
branch: claude/project-thread-d562zn
created: 2026-11-05
updated: 2026-11-05
archived_at: 2026-11-05
---

## Intent

Close [issue #1085](https://github.com/SOFTURE/AI/issues/1085): `finishFootage` brings the whole mix to
`mixLoudness.target` with one gain measured on the mix, so the speech (already at `film.loudness`) moves when the
music volume changes (0.1-0.4 dB between music volumes), and a music volume step is not heard as set.

## Context

Reported by an adopting app (54 s talking film, music volume 0.40 -> 0.45). Builds on #1079's gain plus true peak
limiter stage (on master). No version bump: the coordinator does one combined release. Parallel marketing-kit
changes (#1077, #1081, #1084) touch `pipeline.ts`, `index.ts` and the CHANGELOG; the later merge resolves conflicts.

## Scope

- `mixLoudness.keep: "speech"` with `mixLoudness.tolerance` (LU, default 1): no gain while the render's mix measures
  inside `target ± tolerance`, otherwise the smallest gain to the nearest edge of that window; then #1079's limiter,
  encode, measurement and retries.
- The gate on the encoded mix and the finished file checks `target ± tolerance` (both modes) and `truePeak`.
- The log line and `FinishedFootage` name the render's measured mix and the gain applied.
- `marketing.json` `mixLoudness.keep` / `mixLoudness.tolerance`; README, CHANGELOG.
- Tests on fixtures: two music volumes keep one speech gain (within 0.1 dB) and a quiet-moment step within ±0.5 dB of
  `20·log10(v2/v1)`; a talk with long pauses ends inside the window.

## Constraints

- Without the option nothing changes (`keep` absent or `"loudness"`, tolerance 1).
- `mixLoudness: null` and a silent mix keep their behaviour.

## Notes

- Framing: skipped. The issue states the problem, the measurements and the acceptance.

## Done

`mixLoudness.keep: "speech"` with `tolerance` (default 1 LU): no gain while the render's mix is inside
`target ± tolerance`, otherwise the smallest gain to that window; the #1079 limiter, encode, retries and gate follow,
the gate on the target's tolerance. `FinishedFootage.mix` carries the render's measurement and the gain applied; the
log names the window. Tests in `tools/marketing-kit/src/footage/{loudness,finish}.test.ts` and
`tools/marketing-kit/tests/footage-config.test.ts`; CHANGELOG `## Unreleased`, README. Ships with the next
marketing-kit release.
