---
change_id: jobs-attempt-hook-1215
verdict: approved
---

# Plan review (auto)

- Scope matches #1215: one event per recorded attempt with outcome, code and duration, codes and ids only; the
  classification is the worker's own, so it cannot drift from the package.
- The hook point is after the fenced write, so a refused write reports nothing and a cancel-converted retry reports
  `cancelled`, matching the stored state.
- Risk: a slow hook delays the worker's slot; documented as "keep it in memory", same contract as the other hooks.
- No dependency on auth or telemetry. Approved.
