# Plan: blog-regex-redos

## Phases

1. Test first: `modules/blog/tests/quality/blocks.test.ts` pins the split of headings, list items and footnote
   definitions and times four crafted lines (heading, bullet, numbered item, footnote) against a 200 ms limit; the
   timing cases fail before the fix.
2. Fix: `HEADING = /^(#{1,6})\s/`, `LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/`, `FOOTNOTE_DEF = /^\[\^([^\]]+)\]:/`; the
   block text is `line.slice(match[0].length).trim()`.
3. `modules/blog/CHANGELOG.md` `## Unreleased` entry; gates (typecheck, lint, language gate, tests); pull request
   closing #1109, #1110, #1111.

## Acceptance

- The new test passes; the blog quality test suite stays green (evidence: vitest run).
- CodeQL on the pull request reports no `js/polynomial-redos` in `blocks.ts` (evidence: the code scanning check).

## Decisions (auto)

- Slice instead of a rewritten capture (`\s+(\S.*)?`): the callers trim the tail anyway, and a pattern with no tail
  quantifier cannot backtrack. A heading whose text holds a line separator now stays a heading instead of falling
  back to a paragraph; that is the reading a writer expects.
- One change for the three alerts: same file, same rule.

## Progress

- [x] p1 failing test: 4 timing cases failed before the fix (2.1 to 2.8 s each)
- [x] p2 fix: `npx vitest run modules/blog` 59 files, 772 tests passed
- [x] p3 changelog entry; typecheck, ESLint on the changed files, language gate green; the new test fails with the old `blocks.ts` (4 of 7) and passes with the fix
