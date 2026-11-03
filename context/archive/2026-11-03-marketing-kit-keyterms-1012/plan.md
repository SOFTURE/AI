---
change_id: marketing-kit-keyterms-1012
status: done
---

# Plan: key terms for a footage film's transcript (issue #1012)

Input: change.md, research.md (option 1). Complexity: small.

## Phase 1: key terms through the film, the provider and the cache (TDD)

Files: `src/footage/keyterms.ts` (+ test), `film.ts`, `providers.ts`, `elevenlabs.ts` (+ test), `paid.ts`
(+ test), `pipeline.ts` (+ test), `fake.test.ts`, `src/index.ts`.

- `keyterms.ts`: `SCRIBE_KEYTERM_LIMITS = { maxTerms: 1000, maxCharacters: 50, maxWords: 5 }`;
  `normalizeKeyTerms(terms)` → `{ ok: true; terms } | { ok: false; errors }` (trim, collapse spaces, drop empty,
  dedupe, sort; errors name the term and the limit); `getFilmKeyTerms(film)` → the same for `film.keyTerms ?? []`.
- `film.ts`: `keyTerms?: string[]`. `providers.ts`: `SttInput.keyTerms?: string[]`;
  `FootageRates = Record<PaidStepKind, number> & { keyTerms?: number }`; `FootageCharge.keyTerms?: number`.
- `elevenlabs.ts`: one `keyterms` field per term when the list is not empty.
- `paid.ts`: `getTranscriptCache` adds `keyTerms` (sorted, normalized) to the key only when non-empty; an invalid
  list keeps its raw form out of the key (the run fails before it reads the cache). `estimateFootageFilm` fails on
  invalid key terms and adds `rates.keyTerms ?? 0` per second to transcription when there are terms.
- `pipeline.ts` `transcribeFootage`: validates before the plan; passes `keyTerms` to the STT when non-empty; the
  charge carries `keyTerms: <count>` when non-empty.

## Phase 2: marketing.json

Files: `src/config/schema.ts`, `src/config/config.ts`, `schema/marketing.schema.json` (regenerated), config tests.

- `footage[].keyTerms`: array of strings, checked with `normalizeKeyTerms` in a `superRefine`, resolved normalized.

## Phase 3: docs

README (Transcript bullet, worker example's rates and `onCharge`, the limits note on prices), CHANGELOG
`## Unreleased`.

## Progress

- [x] Phase 1: key terms through the film, the provider and the cache (7c7ce98)
- [x] Phase 2: marketing.json (62ba363)
- [x] Phase 3: docs (7e7c792)

## Verification

- `vitest run tools/marketing-kit/src/footage tools/marketing-kit/tests/footage-config.test.ts tools/marketing-kit/tests/schema.test.ts`: green.
- `npm run typecheck`, ESLint and the language gate green in the pre-commit hook.
