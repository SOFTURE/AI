---
change_id: jobs-sync-state-639
verdict: approved
---

# Plan review: jobs sync state (issue #639)

## Checks

- Scope matches the issue's five asks (tables with migrations, cursor CAS, process-once, list and prune, test helper);
  nothing outside `modules/jobs` and the change folder.
- Invariants as constraints: status set, finished state, attempts bounds, error code on failed, lengths. Good.
- Concurrency: upsert-and-touch locks the row, so two workers on one item serialise; the cursor update is conditional
  on `from`. Good. PGlite cannot show the race; the README already says concurrent behaviour is Postgres behaviour.
- Pruning by `last_seen_at`, not `finished_at`: correct, otherwise a still-listed done item would be redone.
- Defaults pinned by the module test must be updated with the new retention key.

## Findings

1. (minor) Touching `last_seen_at` on every skipped call is one write per already-handled item per poll. Accepted:
   the row is locked by the upsert anyway, and the write keeps pruning safe. Mention it in the README.
2. (minor) `maxAttempts` lowered below an item's attempts: treat as used up and mark `failed` without running. Added
   to step 2.

Verdict: approved with the two notes folded in.
