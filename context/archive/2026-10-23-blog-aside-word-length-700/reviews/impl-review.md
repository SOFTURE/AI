---
change_id: blog-aside-word-length-700
verdict: approved
---

# Implementation review

Reviewed the diff (9e72e6a, 15ed628) against plan.md.

- `LETTER_WORD` now needs two letters at the start of a word; `countWordedAsides` is the only user, so the article
  gate and the copy check change together.
- Tests: the issue's formula passes `checkCopyText` in both rulesets and gives no `stacked-asides` in the article
  gate; asides of one-letter words only pass; two real worded asides (words of two letters) and the existing Polish
  case with a one-letter word between longer words still fail. Written first and seen failing.
- Docs: README rule row and CHANGELOG `## Unreleased` say what changed.
- Gates: blog tests 746 passed; typecheck, ESLint on the changed files and the language gate green.

Verdict: approved, no changes.
