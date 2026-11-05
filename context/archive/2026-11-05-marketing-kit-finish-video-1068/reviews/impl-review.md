---
change_id: marketing-kit-finish-video-1068
verdict: approved
---

# Implementation review

- Matches the plan: `FinishVideo`, `findFinishVideoProblems`, `buildFinishArgs({ video })`, the option on
  `RenderFootageOptions` (and so `RenderFootageFilmOptions`), early validation in `runRenderFootage`, log line.
- Default path: `buildFinishArgs` without `video` produces the same arguments as before (existing exact-argument
  tests unchanged and green); the default re-encode goes through the same helper at `medium` CRF 18.
- Tests: exact arguments with and without the cap, four cap spellings, loudness pass beside the encode, every
  invalid value; early `err` before music or assets; real ffmpeg: an `ultrafast` render ends H.264 High yuv420p.
- Gates: typecheck, ESLint, language gate green; `tools/marketing-kit` and `tests/repo` suites green.
- Progress needs no change: `runFfmpeg`'s `-progress` already drives the finish stage (research).
- Verdict: approved.
