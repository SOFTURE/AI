---
change_id: marketing-kit-draft-loudness-1143
status: implemented
---

# Plan: the render's loudness chain in the draft (issue #1143)

Input: change.md, research.md. Complexity: small (one function's chain, one args option, tests).

## Phase 1: the chain (`draft.ts`)

- File names from `getSpeechChainFiles(draftDir, { isDeclick, isLoudness })`.
- The loudness pass (`normalizeLoudness`, `film.loudness ?? DEFAULT_LOUDNESS`, skipped with `null`), logged as the
  render logs it; progress item `loudness`.
- With `mixLoudness` not null: `buildFilmMixArgs` (speech, music, no sfx) to `draft/mix.wav`, `mixFootage` to
  `draft/mix.m4a`; its failure is the draft's failure; progress item `mix`. A silent mix (null) keeps the tracks.
- `buildFootageDraftArgs` takes `mix` (an encoded mix): the draft maps it and copies it (`-c:a copy`) instead of
  mixing speech and music and encoding them.
- After the run: the draft measured as `finishFootage` measures the film; a fail returns the loudness failure, a near
  miss sets `loudness.warning`. `FootageDraft` gains `loudness: FinishedLoudness | null` and `mix: FinishedMix | null`.

## Phase 2: tests, docs

- Unit: `buildFootageDraftArgs` with `mix` maps and copies it and reads no speech or music.
- ffmpeg: a quiet fixture (a tone at about -40 LUFS) drafts at `-14 ± 0.5` LUFS (the mix aim) and true peak ≤ -1 dBTP,
  with `loudness` and `mix` reported; the stage is skipped with `mixLoudness: null`; existing tests updated for the
  new progress items.
- CHANGELOG `## Unreleased`, README's draft section.

## Acceptance

- The quiet fixture fails on master (the draft measures about -40) and passes with the change.
- Gates: typecheck, lint, `npm test`.

## Decisions (auto)

- No sfx in the draft's mix: the draft has none (its contract); the target is the same, so the integrated loudness
  matches the render.
- The mix's AAC is copied into the draft, not re-encoded at 128k: the measured mix is what plays.
- A mix that misses its target fails the draft as it fails the render: a draft that hides the near miss or the miss
  would not tell the owner what the render will do.

## Progress

- [x] Phase 1: the chain (draft.ts on getSpeechChainFiles, normalizeLoudness, buildFilmMixArgs, mixFootage; mix copied)
- [x] Phase 2: tests, docs. Evidence: the quiet-fixture test fails on master (no loudness reported; the draft keeps the source level) and passes with the change (draft within 0.5 LU of -14, true peak <= -1 dBTP, re-measured with ebur128); `npx vitest run tools/marketing-kit` 1114 passed, typecheck and lint green.
