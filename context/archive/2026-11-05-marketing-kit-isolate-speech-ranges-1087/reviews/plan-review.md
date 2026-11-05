---
change_id: marketing-kit-isolate-speech-ranges-1087
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (a5deade).

- Coverage of the issue: range choice from the EDL's sound spans with a margin, clamped (1); cut, isolate, cache by
  clip identity + range in ms + provider, charge `isolate` (2); lay back into one file as long as the clip with
  windows switching at the middle of an overlap (1, 2); estimate of uncached ranges (2); free draft without
  `isCommit` (2); mono answers matched to the stereo clip (1).
- The render needs no change: the block answers the same speech map.
- Conflict risk with PR #1088 (declick) is low: this change does not touch `render.ts` or `buildSpeechArgs`; shared
  files are export lists, README and CHANGELOG.
- Risk: a hard switch from raw to cleaned sound at a window edge; the edges sit in the margin, outside what the cut
  plays, except the half cut fade.

Verdict: approved, no changes.
