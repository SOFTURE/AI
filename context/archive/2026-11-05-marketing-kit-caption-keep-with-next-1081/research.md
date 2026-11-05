---
change_id: marketing-kit-caption-keep-with-next-1081
---

# Research: keep a caption word with the next (issue #1081)

## Where captions are cut into cards

- `tools/marketing-kit/src/compose/timeline.ts` `captionChunks(words, maxWords = 4)`: pushes each word, flushes after
  a word ending in `.,?!:;` or at `maxWords`. Used by screen films (`compose/compose.ts`, per beat's voice-over) and by
  footage films' `highlight` style (`footage/compose.ts`, `footage/draft.ts`).
- `tools/marketing-kit/src/footage/captions.ts` `phraseChunks(words)`: the footage default (`phrase`): a group ends at
  punctuation (`…` included), after six words or at a silence over 0.7 s; a group of one word joins the previous one
  when it has room and no pause separates them. Used by `footage/compose.ts` and `footage/draft.ts`.
- Both receive the film's words in film time: `remapWords(edl, transcript.words, fillers)` (`footage/edl.ts:363`),
  called by `pipeline.ts:658` (render) and `draft.ts:488` (draft). Two words split by a cut are adjacent there and
  their silence is the cut's removed gap, so the pause rule rarely separates them.

## Film option path

`FootageFilm` (`footage/film.ts`) ← `config/config.ts` mapping ← `config/schema.ts` (zod, `captionMaxLines` beside
it) ← `marketing.json`; `schema/marketing.schema.json` is generated from the zod schema (a repository test compares
them). Per-language data already sits in `film.ts` (`DEFAULT_FILLERS` keyed by `language`).

`buildFootageDraftCaptions` takes `film: Pick<FootageFilm, "captions" | "captionStyle">`; it needs `language` and the
new option too. `composeFootage` takes the whole film.

## Which words keep with the next

- Polish typography keeps one-letter words (`a i o u w z`) off a line's end; short prepositions (`we ze na do od po
  za ku`) read badly at a card's end too. English: the articles `a an the`.
- A number torn from its unit (`50` | `PLN`) is the other case the issue names; a number followed by punctuation
  ends a clause and breaks anyway.
- The language gate rejects some Polish words outside `pl/` folders (`tools/config/src/language/pl/polish.ts`); none
  of the words above is on its list.

## #1077

#1077 (per-segment caption box) changes `footage/compose.ts`, `footage/draft.ts` and `footage/captions.ts` around
the same lines. This change is built on master after it merges.
