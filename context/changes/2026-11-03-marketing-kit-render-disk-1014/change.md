---
change_id: marketing-kit-render-disk-1014
title: "marketing-kit: footage renders fail with code 1 when hyperframes' temp folder has under 1 GiB free (issue #1014)"
status: in_progress
roadmap_item: null
issue: 1014
branch: claude/project-thread-nyfwiw
created: 2026-11-03
updated: 2026-11-03
---

## Intent

Close [issue #1014](https://github.com/SOFTURE/AI/issues/1014). hyperframes 0.8.85 refuses to render when its temp
folder (`os.tmpdir()`) or its output's folder has under 1 GiB free, and the kit only reports
`hyperframes render ended with code 1`. After this change:

1. `checkFootageTools({ needsRender: true })` reports a temp folder or build folder with under 1 GiB free, naming it;
2. `renderFootage` checks the same before the speech, music and assets steps and returns a sentence;
3. the worker recipe and README say `TMPDIR` needs room for the extracted frames (a data volume, not a small tmpfs),
   and name `HYPERFRAMES_EXTRACT_CACHE_MAX_MB` and `PRODUCER_MAX_WORKERS`;
4. `renderFootage` takes a `tempDir` option, passed to hyperframes as `TMPDIR`.

## Context

Labels: `bug`, `pkg: marketing-kit`. Files: `tools/marketing-kit/src/footage/tools.ts`, a new
`src/footage/disk.ts` with tests, `src/footage/pipeline.ts` (`renderFootage`, `runHyperframesRender`),
`src/index.ts`, `docker/footage-worker.Dockerfile`, README, CHANGELOG. Issue #1012 (key terms) runs in parallel on
the same package: it touches `transcribeFootage`, the STT provider and the estimate, so the overlap is limited to
`src/index.ts`, README and the CHANGELOG's `## Unreleased`.

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- The kit's threshold matches hyperframes' own (1024 MiB from `statfs` `bsize * bavail`); a folder whose free space
  cannot be read is not reported (hyperframes passes it too).
- English only; the adopting app is not changed.

## Notes

- Framing: skipped. The issue names the failure and a concrete API, and hyperframes' source confirms it.
