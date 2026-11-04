---
change_id: marketing-kit-render-crf-1036
status: in_progress
---

# Plan: an encoder CRF for the footage render (issue #1036)

Input: change.md, research.md (option 1). Complexity: small.

## Phase 1: the option and its argument (TDD)

Files: `src/footage/pipeline.ts` (+ test).

- `RenderFootageOptions.crf?: number`: hyperframes' `--crf`, overriding the tier's CRF.
- `getHyperframesRenderArgs` picks `crf`; adds `--crf <n>` after `--quality`; a value that is not an integer in
  0-51 throws `crf must be a whole number from 0 to 51, got <n>.` (a programming error, like `workers`).
- Tests: `--crf 18` with `draft`, 0 and 51 accepted, -1, 52 and 18.5 rejected, no `--crf` without the option.

## Phase 2: docs

README "Footage films in a worker" (the option, the tier's preset and the draft capture's JPEG 80, the issue's
numbers), CHANGELOG `## Unreleased`.

## Decisions (auto)

- No x264 preset option: hyperframes 0.8.85 has no way to set it apart from `--quality` (research).

## Progress

- [ ] Phase 1: the option and its argument
- [ ] Phase 2: docs
