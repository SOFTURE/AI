---
change_id: core-zoned-time-783
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and issue #783.

- Scope: matches the issue's three functions; the extra exports (`getWallClock`, `getZonedInstant`, `WallClock`) are
  what lets jobs drop its copy, which the issue asks for.
- Behaviour: the algorithm moves verbatim, so the jobs schedule tests (both Warsaw DST changes, minute walk) guard
  the move; the new core tests cover the cases the issue lists plus a skipped midnight.
- Risks: the skipped-midnight case depends on the runtime's tz data for `America/Santiago`; Node 22 ships 2026 ICU
  data where Chile starts DST on the first Sunday of September at 00:00. Check the expectation against the runtime
  before asserting it. `config.ts`'s message for an invalid `timezone` must stay the same.
- Release: the jobs range cannot move before core is released; recorded under Before the next release.

Verdict: approved.
