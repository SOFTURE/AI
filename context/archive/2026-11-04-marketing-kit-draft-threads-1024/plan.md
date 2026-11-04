---
change_id: marketing-kit-draft-threads-1024
status: done
---

# Plan: ffmpeg thread count for the footage draft (issue #1024)

Input: change.md, research.md (option 1). Complexity: small.

## Phase 1: the draft's thread option (TDD)

Files: `src/footage/normalize.ts`, `src/footage/draft.ts`, `src/footage/draft.test.ts`.

- `normalize.ts`: `getThreadArgs(threads, option)` exported for the footage modules (not from the package index); the
  message names the option. `buildNormalizeArgs` passes `"normalize.threads"` (message unchanged).
- `draft.ts`: `FootageDraftArgsInput.threads?` and `RenderFootageDraftOptions.threads?`. `buildFootageDraftArgs` adds
  `-filter_complex_threads N` before the inputs, `-threads N` before each segment's `-ss`, and `-threads N` before the
  output; `renderFootageDraft` passes the option through.
- Tests: no thread arguments by default; with `threads: 1` the global, per-input (one per segment, not the speech
  input) and output arguments in place; invalid values throw `draft.threads must be a positive whole number, got X.`

## Phase 2: docs

README (draft section: the `threads` option), CHANGELOG `## Unreleased`.

## Progress

- [x] Phase 1: the draft's thread option (9182819)
- [x] Phase 2: docs (e508087)

## Verification

- `vitest run tools/marketing-kit/src/footage`: 21 files, 248 tests green.
- The kit's own `buildFootageDraftArgs` run through real ffmpeg 6.1 (`taskset`), a 40 s draft of 20 segments from a
  60 s 1080x1920 clip, no captions: on 1 core 14.9 s CPU and 433 MB peak by default; on 4 cores 23.5 s CPU and
  1119 MB by default, 15.9 s CPU and 433 MB with `threads: 1`. Both drafts are 1200 frames of 540x960.
- typecheck, ESLint and the language gate green in the pre-commit hook.
