---
change_id: blog-analytics-adoption-gaps
reviewed: plan.md
date: 2026-10-07
verdict: approved with fixes applied
---

# Plan review: blog-analytics-adoption-gaps

Checked `plan.md` against `change.md`, issue #196, the renderer, gate, CLI, publish run and article store of
`modules/blog`, the endpoint, channel reader, options and browser keeper of `modules/analytics`, and the adopting
app's directive parser, publish script, tables and beacon (read only).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | A markdown-it block rule runs inside lists and quotes too; without a guard a `::chart{}` line in a list item would become a plugin block whose node cannot sit inside list HTML (the same reason fences are top-level only). | Accepted: the rule checks `state.level === 0` and the four-space code indent; tests cover list, quote, fence and indented code. |
| 2 | Warning | `channelField` lets the request itself name its channel, which the endpoint's comment says never happens. | Accepted: off by default; when set, the request must still pass the first-party check, the value must pass the rule, and the README says it trusts the page's script as much as the Referer. The endpoint comment is updated. |
| 3 | Warning | `normalize` applied only on the server would let the browser keeper forget a tag the server accepts (or keep the raw one). | Accepted: `normalize` is part of `ChannelRule`, `parseChannel` applies it in both places, and the keeper writes the normalised value back to the address bar. |
| 4 | Warning | A history entry's old slug may equal a current slug or another article's history; inserting blindly would make one address both a page and a 301. | Accepted: the run refuses with `blog.slug_taken` / `blog.slug_in_history` semantics, tested. |
| 5 | Suggestion | `--stdin` and paths together are ambiguous. | Accepted: a usage error. |
| 6 | Suggestion | The Markdown piece should not answer `*/*` (curl, crawlers) with Markdown. | Accepted: only an explicit `text/markdown` whose weight is at least `text/html`'s. |
| 7 | Suggestion | The line contract needs a terminal line on every outcome so a script can tell "nothing printed" from "refused". | Accepted: `blog|written`, `blog|dry-run`, `blog|refused` or `blog|failed|<message>` always ends the run's output. |
| 8 | Suggestion | `STEP_FIELD` is exported; removing it would break importers. | Accepted: kept as the default first field. |

No finding blocks the plan.
