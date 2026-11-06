---
change_id: marketing-kit-draft-loudness-1143
verdict: approved
---

# Implementation review (auto)

- The draft's chain is the render's: `getSpeechChainFiles`, `normalizeLoudness`, `buildFilmMixArgs`, `mixFootage`,
  `getLoudnessVerdict`; nothing copied, so #1139's lossless chain reaches the draft unchanged.
- The mix's AAC is stream-copied (`-c:a copy`), so the measured mix is what plays; the length test (exactly the cut's
  length, fast start) still passes with it.
- `loudness: null` and `mixLoudness: null` skip their stages (tested); a silent mix falls back to the tracks as cut.
- A missed mix fails with `{ kind: "loudness" }` from `mixFootage`; the written draft is gated like the finished film.
- Tests: the quiet fixture fails before the change and passes after; existing progress and failure-input expectations
  updated for the new items and the copied mix. CHANGELOG `## Unreleased` and README updated. No Polish in the diff.
- Approved.
