---
change_id: marketing-kit-ffmpeg-failure-1063
status: in_progress
---

# Plan: ffmpeg failure diagnostics (issue #1063)

Input: change.md, research.md. Complexity: medium (process runner, one new module, entry points, docs).

## Phase 1: the failure and its folder (TDD)

Files: `tools/marketing-kit/src/footage/ffmpeg-command.ts` (new), `ffmpeg-failure.ts` (new), `process.ts`, tests.

- `FfmpegFailure { step, args, cwd, code, signal, stderr, inputs }`; pure helpers: `findFfmpegInputs` (lavfi kept as
  is, files resolved against cwd), `quoteShellArgument`, `formatFfmpegCommand`, `splitFilterGraph` (top-level `;`,
  quotes and escapes respected).
- `runFfmpeg`: on a non-zero exit or a failed start builds the failure, logs one line
  (`ffmpeg failed: <step>, in <cwd>: ffmpeg ...`), awaits the hook (its own error is logged, the ffmpeg error still
  thrown), then throws the same text as before. `withFfmpegFailureReporting({ onFailure, log }, run)` sets them for
  every step inside (an inner call keeps the outer values it does not set).
- `writeFfmpegFailure(dir, failure, { signal })`: `command.sh` (cd to cwd, graph from `filtergraph.txt`),
  `filtergraph.txt`, `stderr.log`, `inputs.json` (`runFfprobe` per file input).
- Tests: helpers; a real ffmpeg run with a broken graph gets the exact failure; its `command.sh` fails the same way.

## Phase 2: entry points

Files: `pipeline.ts`, `draft.ts`, `index.ts`, `draft.test.ts`.

- `FootageRunOptions.onFfmpegFailure`; `prepareFootage`, `transcribeFootage`, `renderFootage`, `renderFootageFilm`,
  `renderFootageDraft` (its options pick it), `cutFootageFilm` (`onFfmpegFailure`) wrap their body.
- Test: a draft whose clip is not a video hands over the failure of "The footage draft" with args, cwd and stderr;
  without the hook the same error text.

## Phase 3: docs

CHANGELOG `## Unreleased`, README "Footage films in a worker": what to keep when a step fails.

## Decisions (auto)

- Option 2 (AsyncLocalStorage): covers every nested step without changing helper signatures.
- The log line is written with or without the hook (ask 3 stands on its own; the thrown text is unchanged).
- `cwd` is always the folder ffmpeg ran in (the process folder when the step sets none), so `command.sh` can cd.
- The hook may return a promise; the step awaits it before throwing, so an app can `await writeFfmpegFailure`.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Implementation review
