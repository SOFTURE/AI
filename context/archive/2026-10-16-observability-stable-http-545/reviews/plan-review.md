---
change_id: observability-stable-http-545
reviewed: 2026-10-16
verdict: approved
---

# Plan review: observability-stable-http-545

Checked plan.md against change.md, research.md, issue #545 and `start.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | `onEnding` runs while the span is writable (research.md), so the copy lands on the exported span. | No change. |
| 2 | Check | Copying only when the stable key is absent keeps a value set by a newer Next.js. | No change. |
| 3 | Minor | `http.target` may already be a full URL on some servers; `url.path` must stay a path. | Parse with `new URL(target, "http://x")` and take `pathname`. |

No Critical findings.
