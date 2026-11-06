---
change_id: marketing-kit-range-gain-1159
title: "marketing-kit: cached speech ranges land at the pre-gained level (issue #1159)"
status: archived
roadmap_item: null
issue: 1159
branch: claude/project-thread-l357as
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close [issue #1159](https://github.com/SOFTURE/AI/issues/1159): since the speech pre-gain (#1139, PR #1152)
`isolateSpeechRanges` lays every cleaned window over the clip's pre-gained sound, but a range cached from the
un-gained sound keeps its old level, so the voice drops by the clip's pre-gain inside that window. Cached and newly
bought windows must land at the same level, and the speech outcome must expose each clip's pre-gain so an app that
lays its own ranges can correct the same way.

## Context

Labels: `pkg: marketing-kit`. A regression of PR #1152 (0.16.0). Ships as marketing-kit 0.16.1, after 0.16.0 is on
npm (another thread releases 0.16.0).

## Constraints

- Cache keys stay unchanged: nothing is bought again.
- Additive API only (patch release).

## Notes

- Framing: skipped. The issue names the problem and the acceptable fixes.

## Done

A range cached from the un-gained sound is raised by the clip's pre-gain when laid; a bought range records its input
gain in `<path>.gain.json`, and a range without a record is classified by loudness. `IsolatedSpeech` and
`TranscribeOutcome` answer `speechGainDb`. PR #1164. Ships in the next combined marketing-kit release (with #1163).
