# Implementation review: marketing-kit-draft-text-size

Checked the diff against plan.md and change.md.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | Without `fonts`, a keyword or lower third wider than its box now breaks by the `OVERLAY_CHAR_EM` estimate (before: one line past its card). A behaviour change for callers that do not pass fonts. | Kept: it is the render's behaviour (the card wraps), and the estimate is the layout's own measure. Noted in CHANGELOG through "broken into the lines the render's card breaks it into". |
| 2 | Suggestion | `-0` from an empty line's width would compare unequal with `toBe(0)`. | Fixed (`+ 0`), tested. |
| 3 | Warning | A role font of the body's family is drawn with the body's file (as before), so an interface weight that differs from the captions' is not drawn. | Kept: two files of one family make libass pick by weight, which can swap the captions' file. Documented in code. |
| 4 | Suggestion | The render's CSS letter spacings were literals, the draft's constants could drift. | Fixed: the CSS now reads the same constants (`toCssEm`), output byte-identical (snapshots unchanged). |

No drift from the plan beyond the recorded decisions. Tests are real (Chromium and libass), the regression test fails
on the old draft arguments. Verdict: ready to archive and merge.
