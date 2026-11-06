---
change_id: marketing-kit-isolate-ranges-resilience-1127
title: "marketing-kit: isolateSpeechRanges keeps going past a refused range (issue #1127)"
status: archived
roadmap_item: null
issue: 1127
branch: claude/project-thread-15z9hz
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close [issue #1127](https://github.com/SOFTURE/AI/issues/1127): `isolateSpeechRanges` returns `err` on the first
range the provider refuses, so every range already bought in that call is thrown away. Retry a refused range, answer a
per-range outcome instead of failing the call (a range refused on every attempt keeps the clip's own sound in its
window), crossfade every join between the base and a cleaned window, let the caller name each range's charge item, and
let an app that already holds paid ranges under its own keys point the block at them.

## Context

Labels: `pkg: marketing-kit`. Follow-up to #1087 (0.13.0). Parallel marketing-kit threads: #1126 (footage failure
kinds) and the footage charge units thread; this change owns `isolate-ranges.ts`, `speech-ranges.ts` and their tests,
plus small spots in `paid.ts`, `index.ts`, README and CHANGELOG. No version bump: one combined release follows.

## Constraints

- Only a cancel (the signal) throws; a provider refusal never fails the call.
- `cached` and `laid` stay on `IsolatedSpeechRange`; the charge's shape stays.
- The acceptance tests from the issue run through the fake provider and ffmpeg.

## Notes

- Framing: skipped. The issue names the gap, the parts of the fix and the acceptance tests.

## Done

`isolateSpeechRanges` retries a refused range, answers a per-range `outcome` instead of failing the call (a range
refused on every attempt keeps the clip's own sound in its window), crossfades every join (`fadeMs`, default 15 ms),
and takes `chargeItem` and `rangeCache`. Ships in the next combined marketing-kit release.
