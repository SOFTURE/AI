# Research: blog-regex-redos

## Findings

- `splitBlocks` (`modules/blog/src/quality/blocks.ts`) matches every trimmed-end line against `HEADING`
  (`/^(#{1,6})\s+(.*)$/`), `FOOTNOTE_DEF` (`/^\[\^([^\]]+)\]:\s*(.*)$/`) and `LIST_ITEM`
  (`/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/`). It is called by `checkArticle`, `checkCopy` and the refresh scan, so it reads
  article bodies from files and from the database.
- `.` does not match a line terminator, while `\s` does. A line `#` + n spaces + `x` + U+2028 + `x` lets `\s+` and
  `.*` share the whitespace run; `$` fails at the separator and the engine tries every split: O(n^2). Measured before
  the fix: 50 000 spaces take 2.1 to 2.8 s per line (new test in `tests/quality/blocks.test.ts`). The body is split on
  `\n` and the end is trimmed, but U+2028, U+2029 and a bare CR (when `splitBlocks` gets a body that was not
  normalised) survive inside a line.
- Every captured tail is trimmed by the caller, so the `(.*)$` capture is not needed: matching only the marker and
  one whitespace character, then slicing the rest of the line, gives the same text in linear time.
- Other patterns in the file (`FENCE`, `CONTINUATION`, `/^>\s?/`, `/^﻿/`, `/\r\n?/g`) have no overlapping
  quantifiers and were not flagged.
