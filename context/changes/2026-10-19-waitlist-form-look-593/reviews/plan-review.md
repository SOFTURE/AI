---
change_id: waitlist-form-look-593
reviewed: 2026-10-19
verdict: approved
---

# Plan review: waitlist-form-look-593

Checked plan.md against change.md, research.md, issue #593, `waitlist-form.tsx`, `waitlist.tsx` and the ui primitives.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every ask of the issue maps to a prop: button width/look (`submitFullWidth`, `submitVariant`, `classNames.submit`), consent description and look (`scope.description`, `scopeClassNames`), label class and placeholder (`fieldClassNames`, `emailProps.placeholder`), stable ids (`emailProps.id`, `scope.inputId`). | No change. |
| 2 | Minor | `scope.inputId` must stay unique when the same form is mounted twice on a page (hero and footer); the package cannot guarantee that. | Documented: the app picks distinct ids per placement; without one ui generates a unique id as today. |
| 3 | Check | The scope checkbox is remounted by `key` after each answer; an explicit id keeps the same element id across remounts, which is what the sticky-bar case needs. | No change. |
| 4 | Check | All new props optional; defaults equal today's literals (`primary`, full width, no id/placeholder, empty submit class). Additive, no breaking change, no new copy. | No change. |
| 5 | Minor | `fieldHintAs`/`fieldHintProps` have no hint to act on today (the email field has none). | Kept for parity with auth, so an app passes one look object to both packages; cheap and typed. |

No Critical findings.
