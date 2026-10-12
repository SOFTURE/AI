---
change_id: blog-fact-rule-value
reviewed: 2026-10-12
verdict: approved with fixes applied
---

# Implementation review: blog-fact-rule-value

Checked `bacf1e9` against plan.md, change.md and issue #379: `src/quality/facts.ts`, `src/quality/rules/facts.ts`,
`src/quality/index.ts`, `tests/adoption-gaps-379.test.ts`, README "Fact rules", CHANGELOG.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical | A capturing pattern whose group 1 held no number left the sentence unchecked. A group used only for keywords, like the README's own `/limit (of\|for) IKE/i`, then silently skipped every sentence of the rule: the failure mode the issue reports. | Fixed: without a group 1 holding a number the value is the first number of the sentence, as before. Test "reads the first number of the sentence when no group 1 holds a number" covers no group, a group that does not take part and a keyword group; README example uses `(?:of\|for)`. `hasCaptureGroup` removed. |
| 2 | Check | `exec` on a copy without `g`/`y`: the app's regex keeps its `lastIndex`; the two-sentence test pins it. | No change. |
| 3 | Check | The #318 tests pass unchanged; checking every year only widens what passes. | No change. |
| 4 | Check | `refresh` still lists by sentence match; a sentence that does not match a capturing pattern is neither checked nor listed, which is right (no value quoted). | No change. |

Gates: typecheck, lint, `vitest run modules/blog tests/repo` green.
