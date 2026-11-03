---
change_id: marketing-kit-render-disk-1014
verdict: approved
---

# Implementation review: marketing-kit-render-disk-1014

- Asks of #1014: (1) `checkFootageTools` reports the temp folder (and the build folder with `buildDir`) under 1 GiB,
  naming it; (2) `renderFootage` checks both before `getMusic`, so nothing is bought, built or logged, and returns a
  sentence (test: music provider not called, log empty, no `assets/`); (3) README and the worker recipe document
  `TMPDIR` on a data volume, `PRODUCER_MAX_WORKERS` and `HYPERFRAMES_EXTRACT_CACHE_MAX_MB`; (4) `tempDir` reaches
  hyperframes as `TMPDIR`, created when missing.
- Measurement matches hyperframes 0.8.85 `checkDisk` (`statfs` `bsize * bavail`, limit 1024 MiB, unreadable passes);
  a folder that does not exist yet is measured on its nearest existing parent.
- The temp folder is resolved from the same env hyperframes inherits (`process.env` through `getHyperframesEnv`), or
  `tempDir`, so the kit checks the folder hyperframes will use.
- No breaking change: new optional options and exports only; CHANGELOG `## Unreleased`.
- Gates: typecheck, ESLint, language gate green; marketing-kit 861 tests, repository tests green.
- Approved.
