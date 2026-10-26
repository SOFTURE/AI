---
change_id: blog-aside-word-length-700
status: archived
---

# Plan: single letters do not make an aside worded (issue #700)

Input: change.md, research.md. Complexity: small (one regex, tests, docs).

## Phase 1: word length in asides (TDD)

Files: `modules/blog/src/quality/rules/style.ts`, `modules/blog/tests/quality/copy.test.ts`,
`modules/blog/tests/quality/pl/copy.test.ts`.

1. Tests first: the issue's formula sentence passes `checkCopyText` (no `stacked-asides`) in the default and the `pl`
   ruleset, and gives no `stacked-asides` warning in the article gate; an aside of one-letter words only
   (`(a b)`, `(w z)`) is not worded; a sentence with two real worded asides still fails.
2. `LETTER_WORD` becomes `/\p{L}{2,}[\p{L}\d'’-]*/gu`; the doc comment says a word has two letters or more.

## Phase 2: docs

`modules/blog/README.md` rule row, `modules/blog/CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- The regex form from the issue rather than a separate length check: one place, same behaviour for both callers.
- A token like `r2` (letter + digit) is not a word either: it reads as a variable, not as prose.

## Progress

- [x] Phase 1: 9e72e6a
- [x] Phase 2: 15ed628
