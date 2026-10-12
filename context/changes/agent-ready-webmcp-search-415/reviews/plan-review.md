---
change_id: agent-ready-webmcp-search-415
reviewed: 2026-10-12
verdict: approved
---

# Plan review: agent-ready-webmcp-search-415

Checked plan.md against change.md, research.md, issue #415 and `webmcp/index.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Snippets cut around a match found in folded text: folding must keep string length (one char per char), or the offsets point elsewhere in the original. | Taken into Phase 1: fold char by char to exactly one char. |
| 2 | Warning | A failed Markdown fetch must not stay cached, or one network blip hides a page for the page's lifetime. | Taken into Phase 1: drop the cache entry on failure. |
| 3 | Warning | Sitemap fetches cost one request per page; bound them (`maxPages`, default 50) and run a few at a time. | Taken into Phase 1. |
| 4 | Check | No import in `webmcp/`: JSON Schema literals, no zod; the architecture test stays as it is. | No change. |
| 5 | Check | Existing exports untouched; `webmcp.test.ts` passes unchanged. | No change. |

No Critical findings.
