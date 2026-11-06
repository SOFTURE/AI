---
change_id: marketing-kit-declick-repair-1170
verdict: approved
---

# Plan review (auto)

- Scope matches the issue: point 1 (default `off`, the gate gone), point 2 (guard ±80 ms, no gain, local AR repair with
  a 3 ms crossfade, a report with times) and point 3 (the envelope regression test, written first).
- Compatibility: a breaking API change in a 0.x package (minor bump in the combined release); configs keep loading.
- Risk: a click closer than 80 ms to a word stays; accepted by the issue (the boundaries are imprecise).
- Approved.
