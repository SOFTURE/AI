---
change_id: marketing-kit-audio-probe-996
verdict: approved
---

# Implementation review

Reviewed the diff of 340225f..72dd6e3 against plan.md and the issue's three proposals.

- Ask 1: `probeAudio` / `readAudioProbe` answer `{ duration, codec, sampleRate, channels, bitRate }`; the failure is a
  discriminated `reason` (`no-audio-stream` for a file without audio, as asked). Cover art (a video stream in an mp3)
  is ignored; `bitRate` falls back to the format's and is null when neither reports one. External JSON is narrowed
  with zod.
- Ask 2: `checkMusicFileType` and `MUSIC_FILE_TYPES` are the one list; `prepareFootage` runs the same check and probe
  on `music.file` right after the clips, before normalizing or any paid call. Extension lookup uses `Object.hasOwn`,
  so `.constructor` is not taken for a type (tested).
- Ask 3: README shows the upload check and states how the bed is fitted (looped or trimmed by `buildMusicArgs`) and
  ducked (`duckingKeyframes` defaults, `volume` / `duckedVolume`).
- Compatibility: `probeFile` returns the same messages through `runFfprobe`; `readFootageProbe` untouched. The new gate
  is the one behaviour change and the CHANGELOG names it with the conversion command.
- Tests: 29 in `audio.test.ts` (3 with real ffprobe, run only where it is installed) and 3 in `pipeline.test.ts`
  (real ffmpeg, conditional); the pipeline cases fail with `pipeline.ts` reverted (red first). Marketing-kit and
  `tests/repo` suites green; typecheck, ESLint and the language gate green in the pre-commit hook.

Verdict: approved.
