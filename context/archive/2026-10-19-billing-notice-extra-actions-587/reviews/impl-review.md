---
change_id: billing-notice-extra-actions-587
reviewed: 2026-10-19
verdict: approved
---

# Implementation review: billing-notice-extra-actions-587

Reviewed: the branch diff against plan.md, change.md and issue #587.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance "`extraActions` rendered in the `actions` slot after the payment link": `access.test.tsx` checks both links' order and that the extra link's parent is the `actions` slot, for ended and ending access. | No change. |
| 2 | Check | Acceptance "outside the reminder window nothing renders": tested with `extraActions` on an early trial. | No change. |
| 3 | Check | `CurrentAccessNotice` forwards the prop unchanged; typecheck covers the wiring, the component itself is the one under test. | No change. |
| 4 | Check | Only classes are added to the `actions` default; `classNames.actions` is still appended, `unstyled` still drops the defaults (`getSlotClass`). | No change. |
| 5 | Check | No user-visible copy added to billing; README and CHANGELOG `## Unreleased` give the app's migration; no version bump. | No change. |
