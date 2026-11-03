---
change_id: marketing-kit-render-disk-1014
status: done
---

# Plan: footage renders need 1 GiB free in the temp and build folders (issue #1014)

Input: change.md, research.md (option 1). Complexity: small.

## Phase 1: the disk check (TDD)

Files: `tools/marketing-kit/src/footage/disk.ts`, `src/footage/disk.test.ts`, `src/footage/tools.ts`,
`src/index.ts`.

- `disk.ts`: `RENDER_MIN_FREE_BYTES = 1024 ** 3`; `getFreeBytes(path)` (statfs of the path or its nearest existing
  parent, null when unreadable); `getRenderTempDir(env, tempDir?)` (`tempDir`, else the `TMPDIR`/`TMP`/`TEMP` the
  hyperframes process will read, else `os.tmpdir()`); `findLowDiskProblems(folders, { getFreeBytes })` (deduplicated,
  one sentence per folder: what was found, what hyperframes needs, how to fix).
- `checkFootageTools`: options `tempDir`, `buildDir`; with a render, the temp folder and (when given) the build folder.
- Tests: under the limit, at the limit, unreadable, duplicates, temp folder resolution, a missing folder measured on
  its parent.

## Phase 2: the render

Files: `src/footage/pipeline.ts`, `src/footage/pipeline.test.ts`.

- `RenderFootageOptions.tempDir?`; `renderFootage` checks the temp folder and the build folder before `getMusic`
  and returns the sentence; `runHyperframesRender` passes `TMPDIR` (created when missing).
- Test: a `renderFootage` call with an injected low reader returns the sentence before any step runs (log empty).

## Phase 3: docs

README (worker section: disk room, `TMPDIR`, `tempDir`, `HYPERFRAMES_EXTRACT_CACHE_MAX_MB`, `PRODUCER_MAX_WORKERS`),
Dockerfile comment and `ENV TMPDIR` guidance, CHANGELOG `## Unreleased`.

## Decisions (auto)

- The free-space reader is an optional `readFreeBytes` option, documented as injected in tests, like `fetch` of the
  run options: the app-facing option is `tempDir`.
- The build folder is checked, not the final output's folder: hyperframes writes to `<buildDir>/render.mp4`; the final
  pass is ffmpeg, which has no such limit.
- The Dockerfile does not set `TMPDIR` itself: the volume is the app's; it documents `ENV TMPDIR=/data/tmp` instead.

## Progress

- [x] Phase 1: the disk check (459ff94)
- [x] Phase 2: the render (6caa22f)
- [x] Phase 3: docs (7344649)
