---
change_id: blog-copy-check-690
status: in_progress
---

# Plan: a voice check for copy that is not an article (issue #690)

Input: change.md, research.md. Complexity: medium (one module, new public function, ruleset data).

## Phase 1: `checkCopyText` and the new rules (TDD)

Files: `modules/blog/src/quality/check-copy.ts` (new), `rules/copy.ts` (new), `rules/style.ts`,
`check-article.ts`, `settings.ts`, `catalog.ts`, `rulesets/types.ts`, `rulesets/{en,pl}/ruleset.ts`,
`quality/index.ts`, `skill/references/rules.md`, tests under `modules/blog/tests/quality/`.

1. Tests first (`tests/quality/copy.test.ts`, pattern samples): copy mode finds ruleset errors, warnings with a
   count, the app's voice phrases, profit promises with YMYL, rhythm rules, with lines of the text; severity
   overrides apply; clean copy gives no finding. `copySeverity` raises `not-x-but-y-bare` to an error in copy and
   leaves it a warning in articles. Channel mode reports each markup kind once with its line (bold, italics,
   heading, bracket link, image, quote, table, inline code, code block, rule, HTML) and leaves bare URLs and `- ` /
   `1. ` lists alone. `stacked-asides`: two worded asides in one sentence (warning in articles, error in copy),
   three in a post of at most 300 words (copy). `dash-pivot`: a spaced em or en dash between words in copy, not a
   range between numbers. New pl patterns `not-x-but-y-bare`, `verdict-label`, `fragile-spot`; en `verdict-label`
   and `fragile-spot`.
2. Implement: `StylePattern.copySeverity?`; `StyleSettings` (ruleset, voice, options) so style and rhythm rules
   run without an article; `compileVoicePatterns` out of `resolveQualitySettings`; `applySeverity` moved to
   `settings.ts`; `checkCopyText(text, { mode, quality })` returning `{ findings }`; the catalog and the skill's
   rules table gain `stacked-asides` and the new patterns.

## Phase 2: docs

`modules/blog/README.md` (quality gate: copy that is not an article, rules table) and `## Unreleased` in
`modules/blog/CHANGELOG.md` (what the adopting app can drop).

## Decisions (auto)

- Signature `checkCopyText(text, { mode?: "copy" | "channel", quality?: QualityOptionsInput })`: the app passes
  the same `quality` object it gives `blog()`, so language, voice, limits, severity and YMYL match its articles.
  No separate `language` key: one way to set it. Keys that need an article (paths, facts, blocks, plugins) are
  ignored.
- Result `{ findings }`, the same shape as the article gate's minus external links.
- `not-x-but-y-bare` is its own rule id (warning, `copySeverity: "error"`), so an app can tune it apart from
  `not-x-but-y`.
- English gets `verdict-label` and `fragile-spot` too (the product is English-first); no English bare contrast:
  "not X, but Y" is too common in plain factual English.
- `stacked-asides` per sentence is a rhythm rule of articles too (warning); in copy it is an error, and three
  worded asides in a post of at most 300 words is a copy-only error under the same id.
- `dash-pivot` and `channel-markup` are copy-only rules: articles keep the dash density rule, and articles are
  markdown by design. They are documented in the README, not in the article catalog or the writing skill.

## Progress

- [ ] Phase 1: `checkCopyText` and the new rules
- [ ] Phase 2: docs
