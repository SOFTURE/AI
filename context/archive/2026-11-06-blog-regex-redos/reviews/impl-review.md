# Implementation review: blog-regex-redos

Verdict: approved.

- The three flagged patterns (`HEADING`, `FOOTNOTE_DEF`, `LIST_ITEM`) end at the marker plus one whitespace character;
  no quantifier follows another that can match the same character, so each runs in linear time.
- The block text is the sliced, trimmed rest of the line: equal to the old trimmed capture for every line without an
  inner line separator. The full blog suite (772 tests) is unchanged.
- The regression test fails on the old file (4 timing cases, 2 to 3 s each) and passes on the new one; the behaviour
  cases pin the marker rules (`#Fees`, `-item`, `####### seven` stay paragraphs).
- Changelog entry under `## Unreleased`; English only.
