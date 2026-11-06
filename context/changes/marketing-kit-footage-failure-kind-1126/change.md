---
change_id: marketing-kit-footage-failure-kind-1126
title: "marketing-kit: footage failures carry a machine-readable kind (issue #1126)"
status: in_progress
roadmap_item: null
issue: 1126
branch: claude/project-thread-vq50wu
created: 2026-11-06
updated: 2026-11-06
---

## Intent

Close [issue #1126](https://github.com/SOFTURE/AI/issues/1126): `renderFootage` / `finishFootage` fail with a bare
sentence, so an adopting app cannot tell a deterministic gate miss (loudness, publishability) from a transient
failure without parsing English. Every footage failure gets a `failure` with a `kind`:

- `loudness`: the mix or the finished film misses `mixLoudness` (with the measured `{ integrated, truePeak }`, null
  for a silent mix);
- `publishable`: the finished file fails the container, profile or fast start checks (with the problems);
- `input`: the film, its EDL, fonts or settings cannot render as given (same input, same failure);
- `process`: anything else (a process exit, the network, the disk); the app may retry.

The message (`error`) stays as today for logs.

## Context

Labels: `pkg: marketing-kit`. Follows #1124. #1127 works in `isolate-ranges.ts` in parallel (only its import line
changes here). No version bump here: the fix joins the next combined marketing-kit release.

## Constraints

- `error` keeps its sentences.
- An abort still rejects with the signal's reason, and a failed ffmpeg step still throws (unchanged contract).

## Notes

- Framing: skipped. The issue names the need and the shape.
