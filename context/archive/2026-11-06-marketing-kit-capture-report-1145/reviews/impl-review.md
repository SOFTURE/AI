---
change_id: marketing-kit-capture-report-1145
verdict: approved
---

# Implementation review (auto)

- Scope: both asks of #1145 (the `capture` field, the README sentence on `lowMemory: true`). No manifest or lockfile.
- Evidence: unit tests on the issue's summary line, minute durations, streamed encode, ANSI codes, the hint, no
  summary and unknown parts; a real hyperframes 0.9.6 render (`MARKETING_KIT_RENDER=1`) yields a non-null report.
- Correctness: the log still gets every line; a missing or changed summary yields null, never a failure; progress
  lines are not kept (only non-progress lines are collected, a few dozen per render).
- Conventions: pure parser, discriminated union for the parts, English only.
- Approved.
