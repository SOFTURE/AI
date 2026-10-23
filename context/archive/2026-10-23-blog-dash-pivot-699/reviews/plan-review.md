---
change_id: blog-dash-pivot-699
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and `modules/blog/src/quality/rules/copy.ts` on master.

- Scope: both asks of the issue have a step (both-sides numeric skip, glued em dash).
- Compatibility: rule id, severity and message stay; ranges with numbers on both sides, including glued unit
  signs, keep passing, so existing copy tests stay green.
- Edge cases to test: the issue's two sentences, a glued em dash between digits (`10—12`, a range), a glued en
  dash (allowed), one finding per block.

Verdict: approved, no changes.
