---
change_id: marketing-kit-photo-cover-layouts-1163
verdict: approved
---

# Implementation review (auto)

- Scope: the issue's inputs (`layout` with six values, `kicker`, `tone`) and its four acceptance points. Each text
  layout is rendered at 1080×1920 on a generated photo and every lit text pixel is checked against the band and the
  half or third it names; overlong kicker and pill label, a missing glyph in each, and mismatched texts are errors;
  the default keeps 0.16.0's output (the 28 earlier tests pass unchanged); the README lists the layouts with an example
  each.
- Scrim position checked on decoded pixels: top for `title-top`, a stripe for `title-center`, none outside the pill's
  box. `tone: "dark"` gives dark text over a light scrim; `tone: "light"` equals the default.
- Fit is still measured on the drawn pixels (the pill's box included), so no layout clips.
- Visual check: all six layouts plus the dark tone rendered from a gradient test photo and looked at side by side.
- Gates: typecheck, ESLint on the changed files, language gate, marketing-kit tests (1198 pass).
- Approved.
