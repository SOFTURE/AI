---
change_id: blog-aside-word-length-700
status: done
---

# Research

- `modules/blog/src/quality/rules/style.ts`: `LETTER_WORD = /\p{L}[\p{L}\d'’-]*/gu` and `countWordedAsides(prose)`,
  which counts `(...)` groups (no nesting) with at least two `LETTER_WORD` matches. Used for the `stacked-asides`
  warning per sentence in the article gate.
- `modules/blog/src/quality/rules/copy.ts`: sums `countWordedAsides` over the prose for the post-level count; with
  `COPY_SEVERITY` in `check-copy.ts`, `stacked-asides` is an error in copy.
- `LETTER_WORD` is used nowhere else.
- Issue example: `(1 + r/m)` gives `r`, `m`; `(m × n)` gives `m`, `n`: two worded asides in one sentence.
- Existing tests (`tests/quality/copy.test.ts`, `tests/quality/pl/copy.test.ts`) use asides of two or more words of
  three letters or more, plus a Polish aside of a one-letter word between longer words, which still has two words of two letters or more.
- Docs that describe the rule: `modules/blog/README.md` (rule table, "two words or more"),
  `modules/blog/skill/references/rules.md`, `catalog.ts` (description, unchanged meaning).
