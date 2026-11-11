# Plan review: marketing-kit-caption-entrance-underline

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | An ASS `\fad` on the first highlight piece would cut off at the next piece (a word lights 0.05 s in), so a draft entrance would flicker. | Accepted: the draft keeps no entrance, as before; said in the docs. |
| 2 | Warning | libass draws `\u1` in the text colour, so a fallback underline also colours the word. | Accepted: the fallback (no brand style) only; with a style the bar is drawn. |
| 3 | Suggestion | `pop` with an elastic or back ease would overshoot. | Accepted: `power2.out`, a test asserts the tween's scale never passes 1. |

Verdict: ready to implement.
