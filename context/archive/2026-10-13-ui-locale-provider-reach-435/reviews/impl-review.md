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
| 6 | Check | Re-scope (phase 3): every client `getCopy` call goes through `useUiCopyProps`; the only remaining direct call is the server-safe `ServerExternalLink`, which `ExternalLink` now feeds with the provider's copy. | No change. |
| 7 | Check | The generic cast in `useUiCopyProps` is commented (TypeScript cannot resolve `DeepPartial` for a generic key). | No change. |
| 8 | Suggestion | Charts has no provider-level translation; its components keep their `messages` prop. A charts provider would be a second mount for two strings. | Accepted as is; documented in change.md. |
| 9 | Check | No Polish strings added; README examples are English. | No change. |

Gates: see plan.md Progress.
