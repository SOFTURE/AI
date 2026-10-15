---
change_id: mcp-registration-window-520
reviewed: 2026-10-15
verdict: approved
---

# Plan review: mcp-registration-window-520

Checked plan.md against change.md, research.md, issue #520 and `oauth-http.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | A closed window that compares against the database clock would differ from `ctx.clock` in tests and in the scripts. | Taken: every comparison and write uses `ctx.clock.now()` (the script's clock option), never `now()` in SQL. |
| 2 | Warning | Opening when `oauth.registration` is `"open"` writes a row that changes nothing and misleads the operator. | Taken: both scripts refuse with a reason naming the option. |
| 3 | Check | The gate sits after the rate limit, so a flood against a closed route is still limited and logged as 429. | No change. |
| 4 | Check | Default `"open"` keeps every existing app's behaviour; the migration only adds a table. | No change. |
| 5 | Check | `registration_endpoint` stays in discovery, so a client connecting during a window finds it. | No change; tested. |

No Critical findings.
