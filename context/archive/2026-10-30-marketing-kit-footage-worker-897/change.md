---
change_id: marketing-kit-footage-worker-897
title: "marketing-kit: footage blocks that run in a server worker (issue #897)"
status: archived
roadmap_item: null
issue: 897
branch: claude/project-thread-ua4r8z
created: 2026-10-30
updated: 2026-10-30
archived_at: 2026-10-30
---

## Intent

Close [issue #897](https://github.com/SOFTURE/AI/issues/897): the footage blocks of 0.3.1 block the event loop
(`spawnSync`), cannot be cancelled, report only log lines, estimate seconds rather than credits, record nothing about
what was paid and fail late on a server without the HEVC decoder or `zscale`. Make every block that spawns ffmpeg,
ffprobe or hyperframes asynchronous with `signal` and `onProgress`, add `estimateFootageFilm` (credits from
caller-given rates, probes only), `onCharge`, `findCachedStep`, `checkFootageTools` (run by the CLI before
`footage`) and a container recipe for a worker image that CI builds and renders the fixture footage film in.

## Context

Labels: `enhancement`, `pkg: marketing-kit`. Follow-ups #899 and #898 touch the same files and come after this
change; one batched marketing-kit release follows all three (coordinator's brief), so no version bump here.

## Constraints

- The kit hard-codes no prices: rates come from the caller.
- Nothing is paid without `isCommit`; the estimate makes no provider call and normalizes nothing.
- Unit tests need no ffmpeg; the process runner is tested with `node` as the child.
- The screen film's render path stays as it is.

## Notes

- Framing: skipped. The issue names the problem and each block.
