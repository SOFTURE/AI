---
change_id: ui-locale-provider-reach-435
reviewed: 2026-10-13
verdict: approved
---

# Implementation review: ui-locale-provider-reach-435

Reviewed: the branch diff against plan.md, change.md and issue #435.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. Both charts client components resolve `useUiLocale(locale)` inside `"use client"` files; the server components are untouched. | No change. |
| 2 | Check | The new tests fail without the fix (2 of 4 red before, the explicit-prop cases guard the order). | No change. |
| 3 | Check | The charts architecture test pinned the old peer range; updated to the intended `^0.1.7 \|\| ^0.2.0`, the same range as the dev dependency. | No change. |
| 4 | Warning | billing's CHANGELOG gains `## Unreleased`; the #426 and #428 branches add the same heading. A merge after them combines the bullets under one heading. | Accepted; handled when fresh master is merged in. |
| 5 | Check | README names match the exports (`AccountLookup`, not `GrantHistory`; `PaymentRequests` takes no `locale` and is left out). | No change. |

Gates: see plan.md Progress.
