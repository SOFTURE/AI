---
change_id: blog-related-list-static-og
reviewed: 2026-10-09
verdict: approved
---

# Plan review: blog-related-list-static-og

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | New slots with a `blog-*` default would change the default markup and need new rules in `styles.css`. | Accepted: empty defaults (decision 2). |
| 2 | Check | Adding `locale` changes the static pages' metadata for every app; it only adds `og:locale`, which the text pages already emit. | No change. |
| 3 | Suggestion | A `blog({ ogImage })` option would cover the ready-made pages too. | Out of scope: the app's card URL is the app's; the builders take it. |

No Critical findings.
