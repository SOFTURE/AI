---
change_id: observability-ignore-paths-546
reviewed: 2026-10-16
verdict: approved
---

# Plan review: observability-ignore-paths-546

Checked plan.md against change.md, research.md, issue #546 and `start.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Delegating to `ParentBased(AlwaysOn)` keeps today's sampling for every other span. | No change. |
| 2 | Check | Only SERVER spans are matched, so an outgoing call to a health endpoint still shows. | No change. |
| 3 | Minor | The sampler is built while the provider starts, so a bad entry throws from `startObservability`, like a bad endpoint. | Validate in the sampler factory. |

No Critical findings.
