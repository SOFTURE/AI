# Plan: clip-sound-one-sided-channel

## Approach

Measure each clip's channels before its loudness, decide one-sided or not with a pure rule, and put the fold filter in
front of the format change in both the measuring pass and the extraction. Balanced clips keep their exact arguments.

## Phases

### Phase 1: channel balance and the fold (TDD)

- `clip-sound.ts`: `ChannelBalance` (`balanced` | `one_sided` with `live`, `liveRmsDb`, `deadRmsDb`),
  `ONE_SIDED_CHANNEL` (`deadCeilingDb: -70`, `minGapDb: 30`), `buildChannelMeasureArgs(input)`,
  `readChannelRmsDb(stderr)`, `getChannelBalance(rms)`, `getChannelFoldFilter(balance)`, `describeChannelFold`;
  `buildClipSoundMeasureArgs` and `buildClipSoundArgs` take an optional `balance`; `prepareClipSounds` measures the
  balance of every clip with sound, passes it on, logs the fold, returns it on `ClipSound.channels`.
- Tests: the rule (balanced stereo, left-only, right-only, mono, silence, quiet but live), the parser (numbers, -inf,
  no output), the arguments with and without a fold, and with ffmpeg: a left-only talking clip and a right-only b-roll
  come out with both channels within 1 dB and the talking clip at the pre-gain target; a true stereo clip keeps its
  channel difference.
- Done when: `npx vitest run tools/marketing-kit/src/footage/clip-sound.test.ts` green, typecheck and lint clean.

### Phase 2: docs and release notes

- README (footage sound section) and CHANGELOG entry; version bump through the release pipeline after the merge.
- Done when: lint (language gate, links) clean.

## Progress

- [x] Phase 1: channel balance and the fold
- [x] Phase 2: docs and release notes

Evidence: `npx vitest run tools/marketing-kit/src/footage/clip-sound.test.ts` 28 tests green (9 new unit tests on the
rule, the parser and the filter graph; 4 new ffmpeg tests: a left-only voice and a right-only b-roll come out with
both channels within 1 dB and the voice at -23 LUFS, the folded voice reaches both channels of the speech track, true
stereo keeps its channel difference, a failing measure names the clip). `npx vitest run tools/marketing-kit/src/footage`
54 files, 945 tests green. `npm run typecheck` clean, ESLint clean on the changed files.
