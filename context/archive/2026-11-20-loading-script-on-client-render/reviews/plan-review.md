# Plan review: loading-script-on-client-render

| # | Finding | Severity | Decision |
| --- | --- | --- | --- |
| 1 | A `typeof window` switch would mismatch on hydration; the plan uses React's server snapshot instead. | Warning | Accepted as planned. |
| 2 | The old ui test asserted a script on a client render: that locked the bug and is replaced. | Suggestion | Accepted. |

Verdict: approved.
