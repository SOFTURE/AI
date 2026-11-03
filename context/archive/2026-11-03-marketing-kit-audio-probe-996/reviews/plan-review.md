---
change_id: marketing-kit-audio-probe-996
verdict: approved
---

# Plan review: marketing-kit-audio-probe-996

- Covers the issue's three asks: `probeAudio` with a typed no-audio failure, one type list shared by the app and the
  pipeline, and docs on ducking and fitting. Generated music stays out (issue).
- Compatibility: `probeFile` keeps its messages through the extracted runner; `readFootageProbe` is untouched. The one
  behaviour change is the new gate on `music.file`: a file the render could not have used fails earlier, and a file
  with an unlisted extension fails where it used to play. Acceptable for an unreleased minor; the CHANGELOG names it.
- Placement: the gate runs in `getMusic` before the render, after transcripts. Moving it into the config check
  (`findMissingFootageFiles`) would make config loading spawn ffprobe; the plan keeps config checks to the file system.
- Types: the failure is a discriminated `reason`, matching the module standard (expected failures as values).
- Tests: pure readers fully covered; the real-ffprobe test is conditional so CI without ffmpeg stays green.
- Approved without changes.
