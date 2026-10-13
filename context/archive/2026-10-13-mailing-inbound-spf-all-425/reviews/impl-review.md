---
change_id: mailing-inbound-spf-all-425
reviewed: 2026-10-13
verdict: approved
---

# Implementation review: mailing-inbound-spf-all-425

Reviewed: the branch diff against plan.md, change.md and issue #425.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. `isStrictAll` matches whole lower-cased terms (`^[-~+?]?all$`), so `a:all.example.com` and `include:all.example` are not taken for `all` (tested); plan review finding 1 resolved. | No change. |
| 2 | Check | Order: `missing-include` is reported before `weak` (tested with `?all` and no include). | No change. |
| 3 | Check | The sender `spf` check and its `permissive` warning are untouched; the existing pass fixtures end in `~all` and still pass. | No change. |
| 4 | Check | The CLI needs no change: it prints the finding of each inbound check and counts failures generically. | No change. |
| 5 | Check | Docs: README INBOUND bullet, the `inbound` option and `checkInbound` comments, CHANGELOG `## Unreleased` (no version bump, batched releases). | No change. |

Gates: see plan.md Progress.
