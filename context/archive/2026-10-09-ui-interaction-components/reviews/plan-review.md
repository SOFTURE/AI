---
change_id: ui-interaction-components
reviewed: 2026-10-09
verdict: approved
---

# Plan review: ui-interaction-components

Checked plan.md against change.md, issue #319, `modal.tsx`, `action-form.tsx`, `toast.tsx` and the architecture test.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every point of the issue maps to a decision (1–2 menu, 3 confirm, 4 trigger, 5 copy, 6 link, 7 dismissed, 8 contrast). | No change. |
| 2 | Check | Route change without a framework import: `closeKey` keeps `ui/` free of `next/*` (ESLint rule). | No change. |
| 3 | Suggestion | `useDismissed` returning `true` before hydration hides a banner for no-JS visitors. | Kept: a banner is a dismissible extra, and a flash of a dismissed banner is the reported pain. Documented. |
| 4 | Suggestion | A font-weight cue on the checked segment would shift the row's width. | Plan already picks an inset ring; no change. |
| 5 | Check | New copy goes through `src/messages/` in `en` and `pl`, so the architecture test keeps passing. | No change. |

No Critical findings. Research and framing skips are justified in change.md.
