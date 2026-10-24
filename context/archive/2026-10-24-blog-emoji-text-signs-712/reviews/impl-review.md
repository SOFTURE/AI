---
change_id: blog-emoji-text-signs-712
verdict: approved
---

# Implementation review

Reviewed the diff of phase 1 against plan.md and change.md.

- `emojiPattern()` excludes U+00A9, U+00AE, U+2122 only when no U+FE0F follows; the lookahead consumes nothing, so
  `©🚀` still flags `🚀` (tested). Each call returns a new RegExp, so the rulesets share no `lastIndex`.
- Both rulesets use it; `emojiPattern` stays out of the public barrel (no API change).
- Tests: pass cases (three signs) and fail cases (`©️`, `🚀`, `©🚀`, `❤`) in `en` and `pl`; the per-pattern samples
  still trip. Blog suite: 753 passed.
- CHANGELOG `## Unreleased` entry says what an app can drop. README's rule table needs no change.

Verdict: approved, no changes.
