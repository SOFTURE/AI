# Queued thematic roadmaps

One roadmap per backlog group (WORKFLOW §5.1): the file name equals the folder name in `context/backlog/`,
and each backlog folder links back here. Only `../roadmap.md` (the main roadmap) is executed; a queued
roadmap becomes the main one only when the owner promotes it (`softure-roadmap --promote <slug>`).
Finished main roadmaps move to `../archive/<YYYY-MM-DD>-roadmap.md`.

| Roadmap | Theme | Prefix | Status |
| --- | --- | --- | --- |
| [`roadmap-charts.md`](roadmap-charts.md) | SVG chart primitives with accessibility guards (`@softure-ai/charts`, `ui/testing`) | `CH-` | waiting |
| [`roadmap-later.md`](roadmap-later.md) | items parked until an owner step (secrets, accounts, the batch release) is done | `LT-` (and MK-8, EN-9, MO-6, BL-8 carried over) | waiting |

Main roadmap now: [`deploy`](../roadmap.md) (`DP-`, promoted by the owner on 2026-10-05), after blog-followups
closed on 2026-10-05 with every item merged. Archived: [`foundation`](../archive/2026-10-02-roadmap.md),
[`identity`](../archive/2026-10-03-roadmap.md), [`engagement`](../archive/2026-10-03-2-roadmap.md),
[`monetization`](../archive/2026-10-03-3-roadmap.md), [`marketing-kit`](../archive/2026-10-03-4-roadmap.md), [`followups`](../archive/2026-10-04-roadmap.md),
[`blog`](../archive/2026-10-04-2-roadmap.md), [`blog-followups`](../archive/2026-10-05-roadmap.md).

No roadmap carries a FIRE_TRACKER adoption item (owner, 2026-10-03): FIRE_TRACKER adopts the modules in its own
roadmap and sessions. Each roadmap still ends with its own release item.
