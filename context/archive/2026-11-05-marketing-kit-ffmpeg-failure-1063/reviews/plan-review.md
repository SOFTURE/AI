---
change_id: marketing-kit-ffmpeg-failure-1063
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (35d0986).

- Acceptance of #1063: the hook with exact args, cwd and stderr (phase 1 and 2), `writeFfmpegFailure` with the four
  files and a `command.sh` that fails the same way (phase 1 test with real ffmpeg), the log line, unchanged error
  text without the hook (phase 2 test), CHANGELOG and README (phase 3).
- Risk: AsyncLocalStorage context is lost across a callback scheduled outside the async chain; every `runFfmpeg`
  call is awaited inside the entry point's chain, so it holds. Steps run in parallel (`Promise.all` of tracks) keep it.
- Risk: `-/filter_complex` only on 7.1+; the script falls back to `-filter_complex_script` below it; only 6.1 runs
  here, the 7.1 branch is a version check.
- Hook errors are logged, not swallowed, and never replace the ffmpeg error.

Verdict: approved, no changes.
