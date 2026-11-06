# Plan review: blog-regex-redos

Verdict: approved.

- The plan fixes the cause (a tail quantifier that overlaps `\s`) rather than capping line length, and covers all
  three flagged lines plus the numbered list branch of `LIST_ITEM`.
- Behaviour: the old patterns only matched when a whitespace character followed the marker; the new ones keep that
  (`####### x` and `#Fees` stay paragraphs, tested). The trimmed slice equals the old trimmed capture on every line
  without an inner line separator.
- The timing limit (200 ms for 50 000 spaces, against seconds before) leaves room for slow CI runners.
