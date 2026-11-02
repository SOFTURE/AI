---
change_id: blog-linked-terms-without-blocks-937
reviewed: 2026-11-02
verdict: approved
---

# Plan review: blog-linked-terms-without-blocks-937

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | WARNING | Dropping the block plugins from the parse would turn a directive line into linkable text. | Planned: plugins stay registered; only `render` is skipped. Tested with a directive. |
| F2 | SUGGESTION | The render options of the page and the link search must not drift apart. | Planned: one shared options builder in `pages/body.ts`. |

No open CRITICAL findings.
