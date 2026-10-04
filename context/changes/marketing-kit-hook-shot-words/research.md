# Research: marketing-kit-hook-shot-words

Input: change.md, roadmap FU-19. Depth: quick (one schema refinement, no data, no runtime change).
Snapshot: 8723ad8 (master, after FU-18), 2026-10-04.

## Summary
- `videoSchema` (`tools/marketing-kit/src/config/schema.ts`) declares `hook.shots[].word` as
  `nonEmpty.optional()`; its description already says the word is "required on every shot after the first, which
  starts with the film". The video `superRefine` checks only that a given word is a word of the first sentence
  (`getWords(video.beats[0].text)`), on the path `hook.shots[j].word`.
- `composeFilm` (`src/compose/compose.ts`, camera section) starts the first shot at `t = 0` and never reads its
  word; every later shot looks its word up in the opening voiceover and throws
  `Opening shot "<mark>" waits for the word "", which the voiceover does not say.` when the word is missing. Compose
  runs after `record` (browser and paid voiceover), so the mistake costs a recording.
- The fix is one more condition in the same loop of the video `superRefine`: `index > 0 && shot.word === undefined`
  → an issue on `["hook", "shots", index, "word"]`. Zod prefixes the video path, so the loader prints
  `videos[i].hook.shots[j].word: …` (the existing "not a word of the first sentence" case proves the prefix,
  `tests/config.test.ts`).
- The JSON Schema (`schema/marketing.schema.json`) cannot say "required from the second item" without
  `prefixItems` tricks that zod does not emit; the description already states the rule, so the generated file needs
  no change unless the description is edited.

## Current state
- Tests: `tests/config.test.ts` table "refuses %s, naming its path" holds the shot-word case; `makeConfig()` has
  two shots, the second with `word: "That"`. `tests/actions-schema.test.ts` uses the same shape.
- The fixture project (`examples/fixture/marketing.json`) gives its second shot a word, so it stays valid.
- README (`tools/marketing-kit/README.md`, "What can be checked without a browser…") lists the load-time checks;
  the missing word joins that list.

## Risks
- A config that today has a later shot without a word already fails at compose; refusing it earlier breaks no
  working project.
- A first shot that carries a word is accepted and its word ignored, as today; refusing it would change valid
  configs and is outside the roadmap outcome.
