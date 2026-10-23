---
change_id: blog-copy-check-690
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and `modules/blog/src/quality/` on master.

- Scope: every ask of the issue has a step. The function, the `channel` mode with the listed constructs (and what
  stays), and the five rules; the bare contrast keeps a warning in articles and an error in posts through
  `copySeverity`.
- Compatibility: `StylePattern.copySeverity` is optional, so app rulesets and voice phrases compile unchanged.
  Narrowing `checkStyle`/`checkRhythm` input to what they read widens what they accept. New article rules are
  warnings (`stacked-asides`, `not-x-but-y-bare`) or errors on phrases the model article does not use
  (`verdict-label`, `fragile-spot`); the FIRE baseline test guards it.
- Consistency: new article rules enter the catalog and the skill template, so `skill.test.ts` keeps both in step;
  pattern samples keep every regex live.
- Edge cases to test: `nie tylko` and `to nie X, to Y` must not double-report as the bare form; a range
  `2020 – 2024` is no pivot; `(5%)` is no worded aside; an underscore in a URL or `snake_case` is no italics; a
  `* ` or `- ` list marker is no emphasis.

Verdict: approved, no changes.
