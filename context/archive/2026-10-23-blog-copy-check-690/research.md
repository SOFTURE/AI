---
change_id: blog-copy-check-690
---

# Research

## The gate today (`modules/blog/src/quality/`)

- `checkArticle` splits the body into blocks (`splitBlocks`), then runs structure, link, YMYL, style
  (`checkStyle`, `checkMetadataStyle`), rhythm (`checkRhythm`), block, fact and image rules, plus plugins, and
  applies `quality.severity` overrides (`applySeverity`, local to `check-article.ts`).
- `checkStyle` and `checkRhythm` read only `blocks` and `settings` (`ruleset`, `voicePatterns`, `options.ymyl`,
  `options.limits`), not the article. Their `RuleInput` type asks for the article and `today` they do not use.
- `resolveQualitySettings(options, config)` needs `appOrigin` and `timezone`; copy needs neither. The voice
  patterns (the app's phrases plus first person singular) are built inside it.
- `toProse` drops code, images, link targets, URLs and emphasis markers; `splitBlocks` skips fenced code and HTML
  comments and knows headings, lists, tables and quotes. Prose of plain copy goes through both unchanged.
- `StylePattern` has one `severity`. The catalog (`listQualityRules`) lists ruleset patterns with it, and the
  writing skill's `references/rules.md` must name every built-in rule (test `skill.test.ts`). Each ruleset
  pattern has a sample in `tests/quality/{pl/,}patterns.test.ts`; the FIRE baseline test checks that the model
  article has no finding at all.

## The issue's rules against the code

- `not-x-but-y` (pl) matches the "it is not X, it is Y" form with a leading pronoun and the "it is not about X,
  it is about Y" form; the bare "not X, only Y" form (no pronoun) misses. It must exclude the "not only" opener
  (rule `not-only-but-also`) and the forms the existing rule catches, so one phrase gives one finding. The issue wants a warning in articles and an error in
  posts: a ruleset pattern needs a second severity for copy.
- A verdict label ("Conclusion:", "Summary:") at a sentence start: no rule. `empty-conclusion` catches the
  "summing up" adverbs, not the label.
- The fragile-spot cliché family: no rule; `puffery` lists other phrases.
- Stacked asides: no rule. Parentheses survive `toProse`; a "worded" aside has at least two words with letters,
  so `(5%)`, `(2024)` and `(ETF)` do not count.
- A spaced em or en dash between words: `dashes` counts every dash against a density limit in articles
  (`\s[—–-]\s|—`), ranges included. In short copy one pivot dash is already the tell.

## Channel mode

Text pasted into a plain-text editor keeps markdown as literal characters: `**`, `_`, `#`, `[text](url)`, `>`,
`|` tables, backticks and fences, `---` rules, HTML tags and `![alt](src)` images. A bare URL and `- ` / `1. `
lists read fine. Fenced code must be seen before `splitBlocks` drops it, so markup is found on the raw lines.
