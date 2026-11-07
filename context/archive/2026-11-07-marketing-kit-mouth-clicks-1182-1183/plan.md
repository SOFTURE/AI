---
change_id: marketing-kit-mouth-clicks-1182-1183
status: done
---

# Plan: mouth-click detector and declick repair level (issues #1182, #1183)

Input: change.md, research.md. Complexity: medium.

## Phase 1: shared analysis

- `footage/sound-analysis.ts`: the biquad band pass with a given range, frame energies, `getRunningMedian` (moved
  from `declick.ts`, re-exported there so the root export stays).

## Phase 2: the detector (stage A, #1182)

- `footage/mouth-clicks.ts`: `MOUTH_CLICK_RULES`; `findClickCandidates` (the impulse rule: length 1-25 ms, 2-10 kHz
  jump > 12 dB over the ±50 ms median, band floor, normalized autocorrelation < 0.3 at lags 2.5-15 ms over 30 ms,
  10 ms after it ≥ 12 dB under its peak); `getWordBounds` (transcript bound or where the 10 ms energy falls 20 dB
  under the word's peak, whichever is wider); `analyzeMouthClicks` (candidates, bounds, protection check, quiet check
  with the candidates' samples left out); `findMouthClicks({ mono, sampleRate, offset, words })`.
- Tests per rule: zone by energy, -45 dBFS with the clicks left out, periodicity, length and end, band floor on
  digital silence, offset, quiet stretch.

## Phase 3: the repair level (stage B, #1183)

- `declick.ts`: `DECLICK_LEVELS` gains `repair`; `DECLICK_REPAIR_RULES` (150 ms pause, 25 ms per repair, 3 a second,
  1 % of the track); `getPauseZones`; `declickSamples` runs the shared detector for `repair`, keeps the repairs
  inside a long enough pause and outside the protection zone, applies the limits in time order and counts
  `skippedLimit`. `DeclickReport.skippedLimit` (0 for `gentle` / `strong`); `describeDeclick` names it for `repair`.
- Tests: 150 ms pause repaired, 140 ms not; a click in a decay the transcript cut short; next to a -40 dBFS breath;
  5 clicks in a second → 3 repaired, 2 skipped; the 1 % budget; a periodic tone; transcript bounds 20-60 ms inside the
  sound: every sample outside the repairs unchanged and no repair in the energy zone.

## Phase 4: docs

- Exports in `index.ts`, the schema description and `schema/marketing.schema.json`, `film.ts` doc comment, README,
  CHANGELOG under `## Unreleased`.

## Acceptance

- The issues' acceptance tests pass; `gentle` / `strong` tests unchanged apart from the new report field.
- Gates: typecheck, lint, `npm test`.

## Decisions (auto)

- One pull request for both issues: they share the detector and the zone.
- The periodicity and the decay are measured on the 2-10 kHz band, so room rumble does not mask a click.
- A pause for the 150 ms rule is a gap between the words' energy bounds (not the transcript's), after the ±80 ms
  guard; the lead-in and the tail count as pauses with the guard on their word side only.
- `skippedLimit` counts the clicks that fit a pause and the protection zone but break a limit (a repair longer than
  25 ms with its crossfades included).
- `DECLICK_SETTINGS` and `findImpulses` keep `gentle` / `strong` only (`DetectorDeclickLevel`).

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
- [x] Phase 4
