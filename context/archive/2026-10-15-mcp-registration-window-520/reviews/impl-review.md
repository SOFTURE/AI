---
change_id: mcp-registration-window-520
reviewed: 2026-10-15
verdict: approved
---

# Implementation review: mcp-registration-window-520

Reviewed: the branch diff against plan.md, change.md and issue #520.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Default `oauth.registration: "open"` leaves the route as before; the existing OAuth HTTP tests pass unchanged. | No change. |
| 2 | Check | Closed, the gate runs after the rate limit and before the body read: `403 access_denied`, no client row, the request counted (tested up to 429). A failing window read answers 503 and logs the label only. | No change. |
| 3 | Check | Every window comparison and write uses `ctx.clock` (plan review finding 1); the scripts take a `clock` option. | No change. |
| 4 | Check | One-row table enforced by `CHECK (id = 1)` and `open_until > opened_at`; tested. Migration carries its rollback. | No change. |
| 5 | Check | Scripts refuse while OAuth is off or registration is `"open"` (plan review finding 2), refuse to close with nothing stored, and report only the window's end. `--minutes` is a whole number 1 to 1440, checked by the schema and again by `openClientRegistration`. | No change. |
| 6 | Warning | The health check now reads the new table, so an app that upgrades without `softure migrate` reports unhealthy. | Accepted: that is the check's job; CHANGELOG says to migrate. |
| 7 | Check | The adoption test pins `through: 2`, the baseline the README and the adoption SQL name; file 3 runs as a normal migration. | No change. |
| 8 | Check | Docs: option row, "Closed registration" with the script recipe, table in §5, server functions in §10, CHANGELOG `## Unreleased` (no version bump, batched releases). | No change. |

Gates: see plan.md Progress.
