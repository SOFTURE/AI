---
change_id: alerts-package-963
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (c9380e5).

- Acceptance of #963, item by item: `alert` with mail, Slack, Discord, Telegram and generic channels (phases 1, 4),
  deduplication with summarized repeats and `resolve` (phase 2), sending through a jobs queue (phases 2, 3), the jobs
  adapter with `onJobFailed`, `onScheduleStateChanged` and `onQueuePaused` and the health adapter (phases 2, 3), quiet
  hours, the test command and the admin list (phases 2, 4).
- Dependency direction is sound: alerts → jobs, mailing optional; no cycle, no change to other packages.
- Main risk is the counting race; the plan locks the row in one transaction and tests concurrent calls.
- The `onQueuePaused` hook is forward-compatible with #955 without waiting for it.
- Decisions are reversible API choices with reasons; none contradicts change.md.

Verdict: approved, no changes.
