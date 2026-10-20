---
change_id: deploy-checks-pr-cost-627
reviewed: 2026-10-20
verdict: approved
---

# Implementation review: deploy-checks-pr-cost-627

Checked the diff (8d2e25d, 443fb70) against plan.md, change.md and issue #627.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | With a tag, `prepare` runs exactly as before and a failed guard skips `static` and `unit` (`needs.prepare.result != 'failure'`). | No change. |
| 2 | Check | Without a tag and with one shard, `prepare` is skipped; `ref` is empty, so the checkout takes the caller's commit, and `sha` falls back to `github.sha`. | No change. |
| 3 | Check | `unit: false` with several shards and no tag skips `prepare` too (the condition reads `inputs.unit`). | No change. |
| 4 | Check | The aliased input step is byte-equal in the three jobs (pinned by a test); actionlint resolves the alias and type-checks its expressions. | No change. |
| 5 | Minor | The cache key reads the root lockfiles only; a workspace with a nested lockfile shares entries across its changes. | Kept: the commit is in the key and the tools validate their own caches, so a shared prefix only means a less warm restore. |
| 6 | Check | Cache paths are checked line by line (leading `!` allowed for exclusions); `/`, `~` and `..` are refused. | No change. |

No Critical or Major findings.
