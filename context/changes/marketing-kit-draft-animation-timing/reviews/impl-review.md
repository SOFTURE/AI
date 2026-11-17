# Implementation review: marketing-kit-draft-animation-timing

Reviewed the diff against plan.md and change.md.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `getFrameSteps` and `getEasedClipTags` use 30 fps (`FOOTAGE_FPS`); a film rendered at another rate would step at 30. | Accepted as is: footage films render at `FOOTAGE_FPS` only; the helper takes `fps`, so a caller with another rate passes its own. |
| 2 | Suggestion | A counter now writes up to 48 events (1.6 s) instead of 16; libass handles that cheaply, and equal neighbours are joined. | No change. |
| 3 | Warning | The render's letters still fade over 10 ms; the draft shows a letter from its start. | Accepted as is: under a third of a frame; the regression test holds within one frame. |
| 4 | Suggestion | Entrance fades, slides and pops keep their ASS approximations. | As decided in the plan: they settle before a compared state; out of this change's scope. |

No drift from the plan; Progress matches the code and the test runs. Verdict: ready to archive and merge.
