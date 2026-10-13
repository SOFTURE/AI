---
change_id: billing-access-badge-copy-426
reviewed: 2026-10-13
verdict: approved
---

# Implementation review: billing-access-badge-copy-426

Reviewed: the branch diff against plan.md, change.md and issue #426.
Verdict: **approve**.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Check | Drift from plan: the responsive swap is at `md`, not `sm`, and `toneScope="pill"` colours the pill's text rather than tinting it. Both follow from billing's architecture test (only classes ui compiles); recorded in change.md. | Accepted; README and CHANGELOG say `md` and describe `data-tone` as the tint hook. |
| 2 | Warning | The tone class was computed in three places (status, short, and the pill root). | Fixed: one `textClass`, `isPillToned` read once. |
| 3 | Check | Default rendering is unchanged except two new root attributes (`data-kind`, `data-tone`); the existing exact `textContent` and class assertions pass untouched, as do the account and admin page tests. | No change. |
| 4 | Check | `responsive` keeps one text exposed at a time: both swaps are `display`-based, so the hidden one is out of the accessibility tree. An `unstyled` badge must hide one itself; README says so. | No change. |
| 5 | Check | `daysLeft`/`endsAt` are null for lifetime and read-only access, typed as such; the `unlimited` kind still receives the real days left, so an app can word "unlimited" with the count. | No change. |
| 6 | Check | Guards: no raw colours, no inline copy (the prefix text is a prop), all classes compiled by ui (architecture test). | No change. |

Gates: typecheck, lint and the language gate in pre-commit; billing access, architecture and pages tests (53) and the
repository tests pass; the full `npm test` runs in pre-push.
