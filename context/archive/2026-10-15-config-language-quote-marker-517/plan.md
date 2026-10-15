---
change_id: config-language-quote-marker-517
status: archived
---

# Plan: language gate skips a marked verbatim quote (issue #517)

Input: change.md, research.md. Complexity: small (one function, tests, docs).

## Phase 1: the marker in `findPolishText` (TDD)

Files: `tools/config/src/language/index.ts`, `tools/config/tests/pl/language.test.ts`.

1. Tests first: a one-line quote between the markers passes while text after the closing marker is still checked; a
   multi-line region passes and the next line is checked; an unclosed opening marker is a hit on its line; a marker
   inside a code span does not open a region; the marker does nothing in a `.ts` file; a stray closing marker is
   ignored.
2. Implement: split a Markdown line into code-span and text tokens (shared with `removeCodeSpans`), drop everything
   between an opening and a closing marker (state carried across lines), then run the diacritic check on what is
   kept (code spans included, as today) and the word check on the kept text without code spans.

## Phase 2: docs

`tools/config/README.md` (language gate paragraph with an example), `tools/config/CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: the marker in `findPolishText` (`65addad`; 7 tests written first, 3 red before the change)
- [x] Phase 2: docs (README language gate paragraph and example, CHANGELOG `## Unreleased`)

Gates on the branch: typecheck, ESLint and the language gate green (pre-commit); config tests 61 passed; the full
`npm test` runs in pre-push.
