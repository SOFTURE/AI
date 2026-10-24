---
change_id: blog-emoji-text-signs-712
verdict: approved
---

# Plan review

- Scope matches change.md: one rule, both rulesets, no API change (`emojiPattern` stays internal to the rulesets
  unless `text.ts` exports reach the public barrel; check and keep it out of the public API).
- Risk: the lookahead must not drop the pictograph after an excluded sign (`©🚀` still flags `🚀`); add that case.
- Tests cover pass cases (three signs) and fail cases (U+FE0F variant, a real emoji) in both languages.

Verdict: approved, with the `©🚀` case added to the tests.
