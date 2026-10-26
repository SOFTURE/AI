---
change_id: theme-flat-paint-segmented-780
verdict: approved
---

# Plan review

- Coverage: each ask of the issue (checked variant, both slot maps, active and focus look) has a step.
- Risk: the slot unions drifting from ui's. The type test against ui (a devDependency) fails on drift. Accepted.
- Risk: `isLegendHidden` ignored with `unstyled`. Documented in the README; the issue's own map hides it. Accepted.
- Risk: a class conflict between idle and checked weights. Variants sort later (R3); the CSS test checks the
  compiled selector exists. Accepted.
