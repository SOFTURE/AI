---
change_id: deploy-init-pinned-comment
reviewed: 2026-10-14
verdict: approved
---

# Implementation review: deploy-init-pinned-comment

Reviewed: the branch diff against plan.md, change.md and issue #473.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance: with `--workflows-ref` all four callers say "pinned to commit <sha>" and carry neither "pin a commit SHA" nor `git ls-remote`; without it they keep the advice at `master`. Tested per caller. | No change. |
| 2 | Check | Header comment lines stay within 120 characters with a 40-character SHA (longest pinned line: 117). | No change. |
| 3 | Check | Plan review 1: the sentence before the ref ends its own line, so the section tags stand alone. The `uses:` lines and the example comparisons are unchanged (706 deploy tests pass). | No change. |
| 4 | Warning | Generated workflows also have non-comment lines over 120 characters (an `if:` expression, a compose-names comment inside a job); out of scope, the issue is about the header. | Accepted. |
| 5 | Check | CHANGELOG `## Unreleased` entry; no version bump (batched releases). README describes the `uses:` lines only. | No change. |

Gates: see plan.md Progress.
