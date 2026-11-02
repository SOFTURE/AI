---
change_id: pwa-share-target-959
reviewed: 2026-11-02
verdict: approved
---

# Plan review: pwa-share-target-959

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | WARNING | A handler that stops reading a file must not leave the request body half read or hang. | Planned: the route skips unread file bodies when the next part is asked for and cancels the body after `handle`. Tested. |
| F2 | WARNING | The return path in `next` must stay a same-origin path, or the sign-in page becomes an open redirect. | Planned: the route builds it from the configured `action` only; `handle`'s answer is checked to be a path (`/x`, never `//x` or `/\x`). |
| F3 | SUGGESTION | A GET share navigation could be kept by the worker as a page. | Not an issue: the route answers 303, and the worker keeps only 200 HTML. README still suggests excluding the action prefix. |
| F4 | SUGGESTION | Unbounded part headers or field values would let a client hold memory. | Planned: header block capped (8 KiB), text fields capped (`maxFieldBytes`). |

No open CRITICAL findings.
