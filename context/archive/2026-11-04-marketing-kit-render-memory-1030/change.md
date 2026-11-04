---
change_id: marketing-kit-render-memory-1030
title: "marketing-kit: renderFootage memory on a small worker (issue #1030)"
status: archived
roadmap_item: null
issue: 1030
branch: claude/project-thread-gy3pjm
created: 2026-11-04
updated: 2026-11-04
archived_at: 2026-11-04
---

## Intent

Close [issue #1030](https://github.com/SOFTURE/AI/issues/1030). A 45 s 1080x1920 footage film of 12 segments peaks
above a 1.5 GiB worker: hyperframes starts one ffmpeg per `<video>` at once to extract frames, and its Chrome
renderer grows with the frames it captures. After this change:

1. the render's frame extraction runs one ffmpeg for the whole film instead of one per segment;
2. `renderFootage` passes hyperframes' memory settings (workers, low-memory profile) through;
3. the README states what a render needs per stage and per second of film on a small worker, measured.

## Context

Labels: `bug`, `pkg: marketing-kit`. Files: `tools/marketing-kit/src/footage/{pipeline,compose,render}.ts`, their
tests, `src/index.ts`, README, CHANGELOG, `docker/footage-worker.Dockerfile` comments. Issues #1031 and #1025 change
the same package in parallel: merge the fresh master before the pull request.

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- English only; the adopting app is not changed. hyperframes stays pinned at 0.8.85 and is not patched.

## Notes

- Framing: skipped. The issue measures the problem and names the directions.
