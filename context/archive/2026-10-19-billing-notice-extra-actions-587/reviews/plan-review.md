---
change_id: billing-notice-extra-actions-587
reviewed: 2026-10-19
verdict: approved
---

# Plan review: billing-notice-extra-actions-587

Checked plan.md against change.md, research.md, issue #587 and `access-notice.tsx`, `access.tsx`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The prop is optional and additive on both components; existing callers compile and render the same message and link. | No change. |
| 2 | Minor | The slot default changes, so an app's snapshot of the `actions` class list changes. Only classes are added (wrap, alignment, gap); with one action the layout is the same. | Named in the CHANGELOG entry. |
| 3 | Check | Hidden state: the extra nodes sit inside the notice, which returns null outside the reminder window; a test pins it. | No change. |
| 4 | Check | `extraActions` is a `ReactNode`, so the app keeps its own link component and copy; nothing user-visible is added to billing's messages, and the "English only" rule is untouched. | No change. |
| 5 | Minor | `unstyled` apps style the extra action themselves; the slot class getter already drops the defaults. | Documented in README. |

No Critical findings.
