---
change_id: marketing-kit-draft-loudness-1143
title: "marketing-kit: the footage draft runs the render's loudness pass and mix stage (issue #1143)"
status: implemented
roadmap_item: null
issue: 1143
branch: claude/project-thread-8dco15
created: 2026-11-06
updated: 2026-11-06
---

## Intent

Close [issue #1143](https://github.com/SOFTURE/AI/issues/1143): `renderFootageDraft` has no loudness pass, so a
draft of quiet speech (about -40 LUFS at the source) plays at -32 LUFS while the render of the same film lands at
-14 LUFS. The draft must run the render's audio chain: the same speech stages (cut, declick, loudness pass), the same
mix brought to `mixLoudness` (with its `attempts` and `warnTolerance`) under the true peak ceiling, and answer the
measured loudness as the render does (`loudness` with its near-miss `warning`, `mix`).

## Context

Labels: `pkg: marketing-kit`. Follows #1124 (the mix stage before the frames). #1139 (lossless speech chain and
pre-gain) changes the same chain in a parallel thread; this change makes the draft take its chain from the render's
helpers (`getSpeechChainFiles`, `normalizeLoudness`, `buildFilmMixArgs`, `mixFootage`), so #1139's change reaches
the draft without a second edit. No manifest or lockfile change. No version bump here: the fix joins the next
combined marketing-kit release (coordinator).

## Constraints

- The draft still spends nothing and calls no provider.
- `loudness: null` and `mixLoudness: null` keep their render meaning in the draft (no pass, the tracks as they are).
- The true peak limit is never relaxed.

## Notes

- Framing: skipped. The issue measures the gap and names the fix (the render's chain in the draft).
