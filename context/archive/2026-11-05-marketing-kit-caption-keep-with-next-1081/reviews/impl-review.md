---
change_id: marketing-kit-caption-keep-with-next-1081
verdict: approved
---

# Implementation review

- Matches the plan: `splitAfterKept`, `captionChunks(words, number | { maxWords, keepsWithNext })`,
  `phraseChunks(words, { keepsWithNext })`, `DEFAULT_CAPTION_KEEP_WITH_NEXT`, `captionKeepWithNext` (zod, JSON schema,
  config mapping), `getCaptionKeepsWithNext`, `getFootageCaptionChunks` shared by the render and the draft, exports.
- Built on master after #1077: the chunks still pass through `getCaptionChunkLayouts`, so a card's per-segment box
  follows its first word as before.
- Defaults: screen films (`compose/compose.ts`) call `captionChunks` without a predicate and are unchanged; a number
  argument keeps the old meaning (test).
- Tests: exact cards for a kept word at the limit, a number with its unit, a chain of kept words, all kept,
  punctuation on a kept word, a pause after a kept word, the predicate's defaults and overrides, the render's pill
  cards and the draft's ASS line.
- Gates: typecheck, ESLint, language gate green; `tools/marketing-kit` suite green (1089 passed).
- Verdict: approved.
