---
change_id: marketing-kit-render-crf-1036
status: done
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

- [x] Phase 1: the option and its argument (2fa38c7)
- [x] Phase 2: docs (bc970b2)

## Verification

- `vitest run tools/marketing-kit/src/footage/pipeline.test.ts`: 22 tests green (two new: the `--crf` argument and
  its validation; both failed before the change).
- hyperframes 0.8.85's CLI takes `--crf` and applies it as `job.config.crf ?? preset.quality` (research); the issue's
  render with `--quality draft --crf 18` is the measurement of this exact argument list.
- typecheck, ESLint and the language gate green in the pre-commit hook.
