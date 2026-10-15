---
change_id: ui-checklist-row-link-506
reviewed: 2026-10-15
verdict: approved
---

# Implementation review: ui-checklist-row-link-506

Reviewed: the branch diff against plan.md, change.md and issue #506.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | All three asks are opt-in; with none set, the markup is as before (tested: no `li > a`, six `li > span`), and the #407 tests pass unchanged. | No change. |
| 2 | Check | Under `rowLink` the link wraps marker, body and trailing node inside the `<li>`, takes the `row` slot (flex row, focus ring, hover tint on tokens) and the label keeps the label look; plan review findings 1 and 2 resolved. | No change. |
| 3 | Check | Visible trailing text joins the row link's name; the test and README show `aria-hidden` for decorative content, and the icons already are. | No change. |
| 4 | Check | No new copy; the state suffix still comes from the overridable `checklist` messages. | No change. |
| 5 | Check | Docs: component comment and prop docs, README paragraph and example, CHANGELOG `## Unreleased` (no version bump, batched releases). | No change. |

Gates: see plan.md Progress.
