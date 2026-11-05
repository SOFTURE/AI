---
change_id: marketing-kit-speech-declick-1084
title: "marketing-kit: a declick stage in the footage speech chain (issue #1084)"
status: archived
archived_at: 2026-11-05
roadmap_item: null
issue: [1084]
branch: claude/project-thread-67i3pe
created: 2026-11-05
updated: 2026-11-05
---

## Intent

Close [issue #1084](https://github.com/SOFTURE/AI/issues/1084): a footage film's speech track keeps mouth clicks and
lip smacks between words. Add a declick stage to the speech chain of `renderFootage` and `renderFootageDraft`, between
the cut speech track and its loudness normalization, set by `FootageFilm.speech.declick` (`off` | `gentle` | `strong`,
absent: `off`): a gate between words plus removal of short broadband impulses in the pauses.

## Context

Owns `tools/marketing-kit` only (footage speech chain, config schema, docs). Parallel marketing-kit threads (#1077,
#1081 captions, #1085 finish loudness) touch nearby files; conflicts are expected to be small and additive.

## Constraints

- `off` (and an absent setting) runs no extra pass: the speech track is byte-for-byte what it was.
- No version bump: `CHANGELOG.md` `## Unreleased`; the coordinator releases the wave.

## Notes

- Framing: skipped. The issue names the algorithm, its parameters and the tests.

## Done

A declick stage in the footage speech chain (`speech.declick`), in the render and the draft; released with the next
combined marketing-kit release (CHANGELOG `## Unreleased`).
