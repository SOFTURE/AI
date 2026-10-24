# Research: blog-emoji-text-signs-712

- `modules/blog/src/quality/rulesets/en/ruleset.ts` and `pl/ruleset.ts`: rule `emoji`, `severity: "error"`,
  `pattern: /\p{Extended_Pictographic}/gu`. Copy and article checks both read the ruleset patterns.
- Measured in Node: `©`, `®`, `™`, `❤`, `☀`, `‼` are `Extended_Pictographic` but not `Emoji_Presentation`;
  `🚀` is both; `#` and digits are neither (so keycap bases were never flagged).
- The issue's suggestion `\p{Emoji_Presentation}` alone would also stop flagging `❤` and `☀` written without
  U+FE0F, which many renderers still draw as emoji. Narrower and safer: exclude only U+00A9, U+00AE, U+2122 when no
  U+FE0F follows.
- `modules/blog/src/quality/text.ts` holds shared regex helpers (`wordPattern`) that both rulesets import, so the
  pattern lives there once.
- Tests: `tests/quality/patterns.test.ts` (and `pl/`) keep a sample per pattern; `tests/quality/copy.test.ts` checks
  `checkCopyText` end to end.
