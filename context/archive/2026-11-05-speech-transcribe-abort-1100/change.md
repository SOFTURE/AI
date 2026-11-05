---
change_id: speech-transcribe-abort-1100
title: "speech: transcribe takes an abort signal (issue #1100)"
status: archived
archived_at: 2026-11-05
roadmap_item: null
issue: [1100]
branch: claude/project-thread-bn89cw
created: 2026-11-05
updated: 2026-11-05
---

## Intent

Close [issue #1100](https://github.com/SOFTURE/AI/issues/1100), the backlog finding from #956
(`context/backlog/speech-followups.md`): `transcribe` takes no abort signal, so a jobs handler cannot stop a long
transcription when its `context.signal` aborts, and every remaining chunk is still uploaded and billed.

## Context

Owns `@softure-ai/speech` only (`foundation/speech`) and the backlog line. A parallel thread bumps dependencies in
`package-lock.json`; this change leaves the lockfile alone (the version bump rides the next combined release).

## Constraints

- Backwards compatible for callers: `signal` is optional. A new error code is a minor change for an app that switches
  over every code (0.x minor).
- No lockfile change: the CHANGELOG entry goes under `## Unreleased`; the release pull request bumps the version.

## Notes

- Framing: skipped. The finding names the gap and the wanted behaviour.

## Done

- `transcribe` takes `request.signal`; an abort returns the new code `speech.aborted` (issue #1100). Rides the next
  combined release of `@softure-ai/speech` (minor: a new error code).
