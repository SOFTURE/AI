---
change_id: marketing-kit-render-disk-1014
---

# Research: hyperframes' disk check (issue #1014)

## What hyperframes 0.8.85 does

- `dist/cli.js` `checkDisk(path)`: `getFreeDiskMb` = `statfsSync(path)` → `bsize * bavail` in MiB; under 1024 MiB is
  an error ("Low disk space", "<x> GB free at <path>"); a `statfs` failure is "Unable to check" and passes.
- The render command runs the checks with `diskPaths: [tmpdir(), dirname(outputPath)]`. The kit's output path is
  `<buildDir>/render.mp4`, so the folders are the hyperframes process's `os.tmpdir()` and the build folder.
- `os.tmpdir()` reads `TMPDIR` (then `TMP`, `TEMP`) of the hyperframes process, which inherits the kit's env
  (`getHyperframesEnv`). Setting `TMPDIR` in that env moves the temp folder.
- Frame extraction goes to `os.tmpdir()/hyperframes-extract-cache-<uid>`, bounded by
  `HYPERFRAMES_EXTRACT_CACHE_MAX_MB` (default 2 GiB). `PRODUCER_MAX_WORKERS` caps the capture workers, which
  otherwise follow the host's cores.

## Options

1. A small `disk.ts` in the kit: `getFreeBytes(path)` (statfs of the nearest existing folder, null on failure),
   `findLowDiskProblems(folders, { getFreeBytes })` returning one sentence per folder under 1 GiB; used by
   `checkFootageTools` (new options `tempDir`, `buildDir`) and by `renderFootage` (temp folder and build folder,
   before the music step). Pure core, injectable reader for tests.
2. Run `hyperframes doctor` before the render: spawns a process, its output format is not a contract, and it
   checks the browser too (already covered). Rejected.

Option 1. `renderFootage` creates `tempDir` when given (hyperframes would fail on a missing `TMPDIR` too).
