---
change_id: theme-flat-paint-chart-look
verdict: approved
---

# Plan review

- Coverage: every ask of the issue (flag variants and sizes, pin dot, ring per surface, line per surface, tones,
  README, contrast test) has a step.
- Risk: the line deviates from the issue's literal classes. Justified by R1 (a border would double the dash);
  recorded under Decisions and to be stated in the README and the issue comment. Accepted.
- Risk: local types drift from charts' unions. Same exposure as the ui look maps; a charts change that adds a value
  surfaces as a missing key only in the app. Accepted, small.
- Risk: conflicts with the parallel #780-#784 changes in the barrel and README. Merge master right before merging.
