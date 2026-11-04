---
change_id: marketing-kit-mix-loudness-1031
status: in_progress
---

# Plan: the footage film's mix loudness and the ducking timing (issue #1031)

Input: change.md, research.md (option 1). Complexity: small.

## Phase 1: loudness of the finished film (TDD)

Files: `src/footage/loudness.ts`, `loudness.test.ts`, `publish.ts`, `publish.test.ts`, `pipeline.ts`,
`pipeline.test.ts`, `film.ts`, `src/index.ts`.

- `loudness.ts`: `buildLoudnessMeasureArgs` gains `-vn`; `measureLoudness(input, target, { label, signal })` runs the
  first pass and answers `{ kind: "measured"; measurement } | { kind: "silent" }`; `getLoudnessFilter(measurement,
  target)` is the second pass's filter (with the resample), used by `buildLoudnessArgs` and by the finish.
  `normalizeLoudness` keeps its behaviour on top of them.
- `publish.ts`: `buildFinishArgs(input, facts, output, { audioFilter? })`: with a filter and a sound track, the audio
  is filtered and re-encoded to AAC 48 kHz stereo; the video keeps its copy-or-encode rule.
- `film.ts`: `mixLoudness?: LoudnessTarget | null` documented (absent: -14 LUFS, -1 dBTP; null: the mix as rendered).
- `pipeline.ts`: `finishFootage` (exported for the test, not from the index) measures the render when the target is
  not null and the render has sound; a silent mix is logged and finished as today; otherwise the log names the
  measured and target loudness and the filter goes to `buildFinishArgs`.
- Tests: the measure args with `-vn`; `getLoudnessFilter`; `buildFinishArgs` with a filter on a copyable and a
  non-copyable render; a real-ffmpeg test finishing a fixture film (quiet speech-like tone + noise bed) through
  `finishFootage` and measuring the output at -14 ±1 LUFS and true peak ≤ -1 dBTP, with the video stream copied; a
  silent fixture finished as it is; `mixLoudness: null` leaves the mix's loudness unchanged.

## Phase 2: the ducking timing and the config

Files: `src/footage/film.ts`, `pipeline.ts`, `src/config/schema.ts`, `config.ts`, `schema/marketing.schema.json`,
`tests/footage-config.test.ts`.

- `FootageMusic.attack?` / `release?` (seconds); `renderFootage` passes them to `duckingKeyframes` when present.
- `marketing.json`: `music.attack` / `music.release` (0-5 s, optional), `mixLoudness` like `loudness` (`false` or a
  target, default -14 / -1); mapped by `config.ts`. Regenerate the JSON schema.
- Tests: the config maps attack, release and mixLoudness (and their absence); the keyframes follow a given attack.

## Phase 3: docs

README (the finished film's loudness, the ducking timing), CHANGELOG `## Unreleased`.

## Decisions (auto)

- A separate `mixLoudness` instead of widening `loudness`: the speech track's normalization keeps the ducking balance
  predictable, the mix's normalization makes the output publishable; both default on.
- The measurement runs on the render itself; the video stays copied.
- `finishFootage` is exported from `pipeline.ts` only (not from the package index) so the test runs the real path
  without hyperframes.

## Progress

- [ ] Phase 1: loudness of the finished film
- [ ] Phase 2: the ducking timing and the config
- [ ] Phase 3: docs
