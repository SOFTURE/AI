---
change_id: billing-free-tier-962
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (c9380e5).

- Ask 1 (option, state with write access and free limits): Phases 1 and 3. Read-only is left for an app without a
  free tier; research finding 7 shows there is no operator restriction to keep it for. Accepted, recorded.
- Ask 2 (same refusal code, says a plan would raise it): Phase 1 keeps `billing.quota_exhausted` and adds
  `upgradePlanIds`.
- Ask 3 (badge, notice, admin page, reminders): Phase 2; the admin page shows the account through `AccessBadge`, so
  the badge covers it.
- Ask 4 (SQL surface and `/testing`): Phases 3 and 2.
- Risk: adding a status to the exported union breaks an app's exhaustive `switch` at compile time. It is the point
  of the change and only bites an app that turns `free` on at runtime; called out in the changelog. Accepted.
- Risk: the migration drops functions an app's view may depend on. Postgres refuses the drop then; called out in the
  changelog with the fix (drop the view, migrate, re-create). Accepted.

Verdict: approved, no changes.
