# Plan review: pwa-keeps-no-pages

| # | Finding | Severity | Decision |
| --- | --- | --- | --- |
| 1 | A boolean `keepPages` beside `maxPages` would allow `keepPages: false, maxPages: 60`; `0` says the same in one option. | Suggestion | Accepted as planned. |
| 2 | `startPath` keeps a page at install; with no kept pages it must be refused, not silently ignored. | Warning | Accepted: refused at load. |

Verdict: approved.
