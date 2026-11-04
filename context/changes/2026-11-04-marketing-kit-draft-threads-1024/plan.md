---
change_id: marketing-kit-draft-threads-1024
status: in_progress
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

- [ ] Phase 1: the draft's thread option
- [ ] Phase 2: docs

## Verification
