# Research: Voice Isolator minimum input length (issue #1140)

## Current code (master 3f80bb6)

- `src/footage/speech-ranges.ts` `planSpeechRanges(edl, clips, { margin })`: one range per segment sound span (and the
  picture clip's own span under `audio.ownVolume`), widened by `margin` (0.25 s), clamped, whole ms; drops identical
  ranges and ranges inside another; never merges or widens to a minimum.
- `getSpeechRangeWindows(ranges)`: a window is the whole range; overlapping neighbours switch at the middle of their
  overlap. `getSpeechRangeFades` and `buildRangeLayArgs` cut each window out of its cleaned file
  (`atrim` from `range.startMs`), so a window narrower than its range already trims the cleaned file.
- `src/footage/isolate-ranges.ts` `isolateSpeechRanges`: cuts every uncached range to
  `<buildDir>/audio/ranges/<clip>.<start>-<end>.mp3`, sends it with up to 3 attempts (`isolateWithRetries`), and
  leaves the cut file behind after a refusal.
- `src/footage/paid.ts` `estimateFootageFilm(…, { isolate: "segments" })` and `estimateSpeechRanges` price every
  planned range (`FootageEstimateItem.range`).
- `src/footage/providers.ts` `IsolationProvider { id; isolate() }`: no minimum. `elevenlabs.ts` posts to
  `/v1/audio-isolation`; `fake.ts` returns the input bytes.

## The minimum

The issue's two production renders: every refused range was 1.91 to 4.18 s, every accepted one 4.64 to 8.59 s,
refused on every attempt (deterministic, reported as `400 audio_too_short`). The bound lies in (4.18, 4.64]; 4.6 s is
the issue's figure and sits inside it. Confirming it exactly needs paid calls, which this change does not make.

## Shape of the issue's film

One clip, 14 segments, 6 shorter than 4.6 s, gaps under 2 s: merging with a 2 s gap folds every range into one range,
so nothing is short and nothing is refused.

## Overlap with other open work

#1141 changes how providers report failures (status, code, retryable); this change avoids the refusal instead of
classifying it, so the two compose. #1139 may touch the mp3 encodes in `buildRangeAudioArgs`/`buildRangeLayArgs`;
this change does not.
