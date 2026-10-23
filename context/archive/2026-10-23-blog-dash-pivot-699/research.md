---
change_id: blog-dash-pivot-699
---

# Research

- `checkDashPivots` (`modules/blog/src/quality/rules/copy.ts`) matches `SPACED_DASH = /(\S+)\s([—–])\s(\S+)/gu`
  over `toProse(block.text)` and takes the first match where the word before does not end with a digit **and**
  the word after does not start with one. So one numeric side is enough to skip: `Do 65 — po podatku.` and
  `60/65 — osobna pula` pass.
- `SPACED_DASH` needs whitespace on both sides, so `word—word` is never seen.
- One finding per block (the first pivot); the sample is `before dash after` with trailing punctuation cut.
- Tests: `tests/quality/copy.test.ts` ("dash pivots") and `tests/quality/pl/copy.test.ts`. The range test uses
  `2020 – 2024` and the glued `Pages 10—12.`; both must keep passing.
- Ranges in real copy also carry a unit or sign next to the number (`20% – 30%`, `$10 – $20`): today they pass
  because one side is numeric. Under "both sides numeric" they must still read as numeric, so a numeric side
  allows non-letter symbols between the digit and the dash (`20%`, `$20`).
- Docs: README rules table row `dash-pivot`, CHANGELOG `## Unreleased` (none yet; latest is `## 0.4.0`).
