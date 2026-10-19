---
change_id: waitlist-form-pending-label-615
reviewed: 2026-10-19
verdict: approved
---

# Implementation review: waitlist-form-pending-label-615

Checked the diff (6564b1f, d51bb74) against change.md, plan.md and issue #615.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | `pendingLabel={messages.form.pending}` with children `messages.form.submit`, exactly the issue's fix and `ActionForm`'s pattern. | No change. |
| 2 | Check | Tests cover idle (reserve = pending copy, name = submit copy) and pending (busy, name = pending copy, reserve = submit copy); both failed before the fix. | No change. |
| 3 | Check | The accessible name stays the visible label: the reserve is a CSS `::after` from `data-reserve`, and the existing tests that find the button by `en.form.submit` still pass. | No change. |
| 4 | Check | No new props, no copy, no dependency range change (ui 0.3.0 already ships `pendingLabel`). CHANGELOG `## Unreleased` says nothing to migrate. | No change. |

No findings to fix. Gates: typecheck, lint (pre-commit), waitlist tests 200 passed.
