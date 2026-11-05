---
change_id: marketing-kit-caption-keep-with-next-1081
status: archived
---

# Plan: keep a caption word with the next (issue #1081)

Input: change.md, research.md. Complexity: small (two pure functions, one film option, wiring, docs).

## Phase 1: the chunkers (TDD)

Files: `tools/marketing-kit/src/compose/timeline.ts`, `timeline.test.ts`, `footage/captions.ts`, `captions.test.ts`.

- `CaptionChunkOptions { maxWords?: number; keepsWithNext?: (word: TimedWord) => boolean }`;
  `captionChunks(words, options: number | CaptionChunkOptions = {})`, a number meaning `maxWords` (default 4).
- One shared rule (`splitAfterKept` helper in `timeline.ts`): when a card is full (word limit) and its last word is
  kept, the card is cut after its last word that is not kept, and the kept tail opens the next card; when every word
  is kept, the card stays as it is. A word ending in punctuation always ends its card.
- `phraseChunks(words, { keepsWithNext })`: a pause after a kept word does not end the group; the six-word limit
  splits as above; the merge of a lone word is unchanged.
- Tests: exact cards with a kept word at the limit, a kept number, a chain of kept words, all kept, punctuation on
  a kept word, a pause after a kept word, no predicate unchanged.

## Phase 2: the film option and wiring

Files: `footage/film.ts`, `config/schema.ts`, `config/config.ts`, `schema/marketing.schema.json`, `footage/captions.ts`,
`footage/compose.ts`, `footage/draft.ts`, `index.ts`, tests beside them.

- `DEFAULT_CAPTION_KEEP_WITH_NEXT: Record<string, string[]>` (`pl`, `en`); `FootageFilm.captionKeepWithNext?:
  string[]`; zod array of non-empty strings, max 100; config mapping.
- `getCaptionKeepsWithNext(film: Pick<FootageFilm, "language" | "captionKeepWithNext">)`: a predicate that keeps a
  number (`/^\d+([.,]\d+)*$/`) and a word in the list, compared lower-case (`toLocaleLowerCase(language)`).
- `composeFootage` and `buildFootageDraftCaptions` pass it to both chunkers; the draft's film `Pick` grows by
  `language` and `captionKeepWithNext`.
- Export `CaptionChunkOptions`, `PhraseChunkOptions`, `DEFAULT_CAPTION_KEEP_WITH_NEXT`, `getCaptionKeepsWithNext`.
- Tests: the predicate; a render and a draft whose words would end a card on `w` keep it with the next word.

## Phase 3: docs

CHANGELOG `## Unreleased`; README captions paragraph and the draft section.

## Decisions (auto)

- The kept word moves forward instead of pulling the next word back: cards keep their word limit, so the issue's
  `maxCharacters` guard is not needed and is left out (simplest).
- Punctuation wins over the predicate: a sentence end is a natural break.
- A number always keeps with the next word (the issue's "number torn from its unit"); a number before punctuation
  breaks anyway.
- Absent option: the language's default list; `[]`: only numbers. Screen films (`compose/compose.ts`) unchanged.
- No version bump: the coordinator releases.

## Progress

- [x] Phase 1: the chunkers, 3494ba2
- [x] Phase 2: the film option and wiring, 3494ba2 (rebuilt on #1077 by merge)
- [x] Phase 3: CHANGELOG and README, 3494ba2
- [x] Implementation review: approved
