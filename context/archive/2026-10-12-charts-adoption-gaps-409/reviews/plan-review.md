---
change_id: charts-adoption-gaps-409
reviewed: 2026-10-12
verdict: approved
---

# Plan review: charts-adoption-gaps-409

Checked plan.md against change.md, research.md, issue #409, the charts sources and the architecture test.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The architecture test scans `src/svg` and `src/cursor` only; `surface.tsx`, `stacked-areas.tsx` and `event-axis.tsx` must live there so the raw-colour and inline-copy guards cover them. | Taken: the plan places them there. |
| 2 | Warning | A new custom property in styles.css (the event axis' lane index and lane count) fails the token guard unless it joins `LOCAL_PROPERTIES`. | Taken into Phase 3. |
| 3 | Warning | `EventAxis` must not import `chart-cursor.tsx` for `getNextIndex`, or two client modules depend on each other's internals; a plain module both import keeps them separate. | Taken: `cursor-keys.ts`. |
| 4 | Check | `@softure-ai/ui` (a dev dependency) exports `buildThemeCss` and `DEFAULT_THEME`, so the surface test can assert the attribute selector without a browser. | No change. |
| 5 | Check | `data-theme` is no copy attribute for `findInlineCopy`; the surface values are not text. | No change. |
| 6 | Check | Defaults unchanged: `LineChart` without `surface` renders the same markup; `ChartCursor` keeps its key behaviour (existing cursor tests). | No change. |

No Critical findings.
