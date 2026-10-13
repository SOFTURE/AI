---
change_id: ui-query-nav-active-454
reviewed: 2026-10-13
verdict: approved
---

# Plan review: ui-query-nav-active-454

Checked plan.md against change.md, research.md, issue #454 and `query-segmented-nav.tsx`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Without a pathname an empty `href` keeps the parameter on the default link. | Taken: `?` for an empty href (Phase 1). |
| 2 | Warning | `?? ""` on hooks typed non-null fails the typed lint rule; an `eslint-disable` would hide it. | Taken: widen the result type with a comment, no disable. |
| 3 | Check | `active` is typed `Id`, so it can only name an item; no fallback to `defaultId` is needed for it. | No change. |
| 4 | Check | `SegmentedNav` and `getQueryHref` stay as they are (constraint). | No change. |

No Critical findings.
