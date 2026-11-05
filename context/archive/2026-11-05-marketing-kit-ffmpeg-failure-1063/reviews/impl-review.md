---
change_id: marketing-kit-ffmpeg-failure-1063
verdict: approved
---

# Implementation review

Reviewed the diff of 042a841, 55b5523 and 8d405db against plan.md.

- Phase 1: `runFfmpeg` builds `FfmpegFailure` from the spawned args (`-progress` included), the folder it ran in, the
  whole stderr (last 2000 lines) and the `-i` inputs (lavfi kept as is); logs one line, awaits the hook (its own
  error is logged, never thrown over ffmpeg's), then throws the unchanged text. `writeFfmpegFailure` writes the four
  files; `command.sh` picks `-/filter_complex` or `-filter_complex_script` by `ffmpeg -version`.
- Real ffmpeg tests (6.1.1): a broken input hands over exact args, cwd and stderr; a two-chain graph with a missing
  map label kept to a folder, `sh command.sh` exits with the same code and the same stderr (pointers aside), which
  proves the graph file parses with one chain per line and the 6.1 branch of the option check. The 7.1 branch
  (`-/filter_complex`) is not run here (no 7.1 in the container).
- Phase 2: the six entry points wrap their body in `withFfmpegFailureReporting`; nested steps (normalize, LUT,
  picture, cut frames) need no signature change. Draft test: a clip that is not a video hands over "The footage
  draft" with its args, cwd `build/draft`, inputs, the log line, and the kept `command.sh` fails the same way;
  without the hook the thrown text is the same.
- `vitest run tools/marketing-kit`: 69 files, 1027 tests passed; `tests/repo` 850 passed; typecheck and lint clean.
- Phase 3: CHANGELOG `## Unreleased`, README "Footage films in a worker" with the folder's files.

Verdict: approved, no changes.
