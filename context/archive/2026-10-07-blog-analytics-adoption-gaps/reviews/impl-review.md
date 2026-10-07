---
change_id: blog-analytics-adoption-gaps
reviewed: implementation (phases 1-6)
date: 2026-10-07
verdict: approved with fixes applied
---

# Implementation review: blog-analytics-adoption-gaps

Checked the branch diff against `plan.md`, `change.md` and issue #196, point by point, and re-read it for
correctness, tests, security and project patterns.

## Coverage of the issue

| Issue point | Delivered | Evidence |
| --- | --- | --- |
| 1. Directive blocks in the renderer | `BlockPlugin.syntax: "directive"`, `ArticleBlock.attributes`, gate `block-directive` + `requires` | `tests/render-directives.test.ts`, `tests/quality/settings.test.ts` ("directive plugins") |
| 2. Remote publish | `--stdin` (one file or a JSON bundle with optional history), `--format lines` | `tests/cli.test.ts` (stdin, bundle, contract) |
| 3. Import from an app's own tables | `--history` / `runBlogPublish({ history })`, SQL export in README | `tests/history.test.ts`, `tests/cli.test.ts` |
| 4. `text/markdown` representation | `createBlogMarkdown`, `toArticleMarkdown`, `BlockPlugin.markdown` | `tests/article-markdown.test.ts` |
| 5. Configurable wire format | `funnel.wire.stepFields`, `funnel.wire.channelField` | `modules/analytics/tests/wire.test.ts` |
| 6. Channel from the Referer path | `funnel.channelFromReferer` | same |
| 7. Normalising channel tags | `channel.normalize: "trim-lowercase"` (server, keeper, counter) | same |

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Critical (fixed) | `--name` was validated against the wrong variable (`name`, the command word), so every `--stdin --name x.md` was a usage error. | Fixed before commit; the stdin test caught it. |
| 2 | Warning (fixed) | A release through an ssh pipe could not pass `--history` without a file inside the container. | The stdin bundle takes an optional `history`; `--history` with such a bundle is refused as ambiguous. Tested. |
| 3 | Warning (fixed) | A missing `published_at` in the history file said "Invalid input: expected string, received undefined". | The message says the field is required and that `null` means never published. |
| 4 | Suggestion | A registered directive inside a list is neither rendered nor reported by the gate (the gate reads lines, not a tree). | Documented in README §12; the same holds for fences today. |
| 5 | Suggestion | `createBlogMarkdown` reads the database on every Markdown request (no decision cache like the redirects). | Kept: only explicit `text/markdown` requests reach it, the read is one indexed row, and the page itself reads the same row. |
| 6 | Suggestion | `channelField` lets a request name its channel. | Off by default; the request must still pass the first-party check and the channel rule; README and the endpoint header say it is as trusted as the Referer. |

Defaults unchanged: a fence-only app, a run without `--stdin`/`--history`/`--format`, and analytics without
the new keys behave as before (existing tests pass unchanged except for the added `syntax`/`attributes`,
`normalize` and `wire` defaults in equality checks). New behaviour was seen red before the implementation
(phase 1 and the analytics tests run against the old source).

No open finding blocks the merge.
