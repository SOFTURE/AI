---
change_id: marketing-kit-speech-declick-1084
status: archived
---

# Plan: declick stage in the footage speech chain (issue #1084)

Input: change.md, research.md. Complexity: medium (one new module, two call sites, config).

## Phase 1: the declick core (TDD)

Files: `tools/marketing-kit/src/footage/declick.ts`, `declick.test.ts`.

- `DECLICK_LEVELS`, `DeclickLevel`, `DECLICK_SETTINGS` (`gentle`: gate -15 dB, jump 15 dB, crossfade 5 ms; `strong`:
  -20 dB, 9 dB, 8 ms); constants for the word window (40 ms), gate fade (20 ms), pre-onset zone (60 ms), longest
  impulse (30 ms), impulse reduction (-30 dB), frames (2 ms, 1 ms hop), median span (±100 ms).
- `getGateWindows(words)`: word start/end ± 40 ms, merged when the windows (with their fades) would touch.
- `findImpulses(mono, sampleRate, words, level)`: 2-8 kHz band (biquad high-pass and low-pass, cascaded), frame
  energies, running median, jump runs under 30 ms that overlap no word span.
- `getDeclickGain(...)`: the gate (fades outside the windows) times the impulse dips (ramps clamped to the
  neighbouring words), per sample.
- `declickSamples(interleaved, channels, sampleRate, words, level)` returns the samples, the impulses and the gate.
- Tests on a synthetic fixture (tonal words with an onset envelope, room tone at -55 dBFS, 2-6 ms clicks at -30 to
  -22 dBFS in pauses and 20-55 ms before onsets): pause RMS falls by the gate ± 1 dB, every click found with its peak
  down at least 25 dB, no false detection, every word's first 30 ms within 0.5 dB, for both levels.

## Phase 2: the stage in the chain

Files: `declick.ts` (`declickSpeech`: ffmpeg decode to f32le, the core, ffmpeg encode), `pipeline.ts`, `draft.ts`,
`film.ts`, `config/schema.ts`, `config/config.ts`, `index.ts`, the schema JSON.

- `FootageFilm.speech?: { declick?: DeclickLevel }`; `marketing.json` `speech.declick` (default `off`).
- Render: a `declick` asset step between `speech` and `loudness` when the level is not `off`; `RenderedFootage` and
  `FootageDraft` carry `declick: { level, impulses, gateDb } | null`; the stage logs the count and the gate.
- Draft: the same stage after its speech track.
- An `off` film runs exactly the old steps (test on the step list / files).

## Phase 3: docs

README footage section, `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Gain applied in Node on decoded PCM (research option 2), not a `volume` expression: sample-accurate crossfades.
- Impulses are lowered on top of the gate (gains multiply).
- With no words the gate is skipped; impulses are still removed.
- The count goes in the ok value as `declick` (null when off), so an app can test it.

## Progress

- [x] Phase 1: the declick core
- [x] Phase 2: the stage in the chain
- [x] Phase 3: docs
- [x] Implementation review
