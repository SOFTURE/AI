---
change_id: theme-flat-paint-radio-794
verdict: approved
---

# Plan review

- Coverage: each ask of the issue (`RADIO_LOOK` with one checked drawing, `CHOICE_ROW_LOOK`, `CHOICE_CARD_LOOK`,
  tests against the tokens) has a step.
- Risk: no ui slot type to pin the unions to (R2). The render test pins the documented markup instead. Accepted.
- Risk: merge conflicts with the parallel changes in this package. A new file keeps them to the barrel, README and
  CHANGELOG lines. Accepted.
- Risk: focus ring colliding with the checked ring on the card (R5). Solved by the outline decision. Accepted.
