---
change_id: jobs-oldest-running-since
title: "jobs 0.1.13: getQueueStats gives the claim time of the longest-running job"
status: archived
roadmap_item: null
branch: claude/project-thread-c6ocun
created: 2026-11-19
updated: 2026-11-19
archived_at: 2026-11-19
---

## Intent
An adopting app wants to alert when a long job (a video render) hangs: it needs the age of the oldest running job per
queue. `getQueueStats` gives the oldest due pending job only, and no column tells when a running job started:
`updated_at` moves with every lease extension.

## Decisions (auto)
- New nullable column `claimed_at` (migration 11), set by the claim; no backfill (a running job claimed before the
  migration reports null until its next claim, said in the CHANGELOG).
- `QueueStats.oldestRunningSince`: `min(claimed_at)` of the queue's running jobs, a running job whose lease ended
  included (it still holds the queue until the next claim takes it back).
- Not on `Job`: no other reader needs it, and it would change every job shape the module returns.
- Version 0.1.13 (additive).

## Notes
- research skipped: one read in `maintenance.ts`, one column written in `claimDue`; the claim and lease code was read
  in full for the decision above.

## Done
0.1.13 in the package; `admin.test.ts` covers the claim time per queue, unmoved by a lease extension, cleared when the
job ends, and null for a running row with no claim time.
