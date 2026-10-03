# Queued thematic roadmaps

One roadmap per backlog group (WORKFLOW §5.1): the file name equals the folder name in `context/backlog/`,
and each backlog folder links back here. Only `../roadmap.md` (the main roadmap) is executed; a queued
roadmap becomes the main one only when the owner promotes it (`softure-roadmap --promote <slug>`).
Finished main roadmaps move to `../archive/<YYYY-MM-DD>-roadmap.md`.

| Roadmap | Theme | Prefix | Status |
| --- | --- | --- | --- |
| [`roadmap-later.md`](roadmap-later.md) | items parked until an owner step (secrets, accounts) is done | `LT-` | waiting |
| [`roadmap-followups.md`](roadmap-followups.md) | catch-all for gaps found in the other roadmaps; runs last | `FU-` | waiting |

Main roadmap now: [`marketing-kit`](../roadmap.md) (`MK-`, with EN-9 and MO-6 carried over). Archived:
[`foundation`](../archive/2026-10-02-roadmap.md), [`identity`](../archive/2026-10-03-roadmap.md),
[`engagement`](../archive/2026-10-03-2-roadmap.md), [`monetization`](../archive/2026-10-03-3-roadmap.md).

No roadmap carries a FIRE_TRACKER adoption item (owner, 2026-10-03): FIRE_TRACKER adopts the modules in its own
roadmap and sessions. Each roadmap still ends with its own release item.
