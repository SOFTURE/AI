# Plan: marketing-kit-caption-min-words

## Phases

1. `balanceCaptionGroups` in `compose/timeline.ts`; `captionChunks` builds groups and balances them; `phraseChunks`
   takes `maxWords`, `minWords`, `maxCharacters` and balances after its own merge.
2. Film options `captionMinWords`, `captionMaxWords`, `captionMaxCharacters` (film type, config schema and mapping,
   generated JSON schema) passed by `getFootageCaptionChunks`; export, README, changelog, version 0.23.0, deploy's
   peer range.
3. Gates, PR, CI, merge, release marketing-kit.

## Evidence

- p1/p2: unit tests in `timeline.test.ts` and `captions.test.ts` (one-word tail, width overflow, moved words, short
  first card, defaults unchanged); `npm run typecheck`, `npm run lint`.
- p3: CI green on the PR, merge SHA, published version.

## Decisions (auto)

- Off by default (`minWords` 1): other adopters keep their cards; the app opts in.
- A join may pass the target by one word: a sentence's last word stays with its sentence, as the owner asked.

## Progress

- [x] p1 balancing and chunkers, unit tests green
- [x] p2 film options, schema, docs, version
- [ ] p3 PR, CI, merge, release
