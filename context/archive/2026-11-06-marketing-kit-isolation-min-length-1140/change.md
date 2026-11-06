---
change_id: marketing-kit-isolation-min-length-1140
title: "marketing-kit: plan speech ranges the Voice Isolator accepts (issue #1140)"
status: archived
roadmap_item: null
issue: 1140
branch: claude/project-thread-w9qbel
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close [issue #1140](https://github.com/SOFTURE/AI/issues/1140): the kit does not know the Voice Isolator's minimum
input length, so `planSpeechRanges` sends ranges shorter than it (6 of 15 in an adopting app's film), each is refused
three times and keeps the uncleaned voice. The isolation provider names its minimum; the planner merges near ranges
of a clip and widens a short one with the clip's own context; only the heard part is laid; a range that still cannot
pass is not sent, not priced, and marked with a reason; a refused range leaves no work file.

## Context

Labels: `pkg: marketing-kit`. Builds on #1127 (PR #1132, in 0.15.0). Related open issues: #1141 (structured provider
errors, which will let a deterministic refusal skip its retries) and #1139 (lossless speech chain). This change owns
`speech-ranges.ts`, `isolate-ranges.ts`, their tests, the isolation parts of `providers.ts`, `elevenlabs.ts`,
`fake.ts`, `paid.ts`, plus README and CHANGELOG. No version bump here: one combined marketing-kit release follows.

## Constraints

- No paid provider call: the minimum is taken from the issue's production evidence, tests use the fake provider.
- Existing callers keep compiling: new fields and options are optional.

## Notes

- Framing: skipped. The issue names the gap, the parts of the fix and the acceptance test.

## Done

The isolation provider names its minimum input (`IsolationProvider.minSeconds`, 4.6 s for ElevenLabs);
`planSpeechRanges` merges a clip's ranges at most 2 s apart, widens a short one with the clip's own context and lays
back only the heard part; a range that cannot reach the minimum is never sent, marked `skipped` and priced at 0; a
refused range leaves no cut file. Ships in the next combined marketing-kit release.
