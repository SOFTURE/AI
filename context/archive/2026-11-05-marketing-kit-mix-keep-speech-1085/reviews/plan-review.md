---
change_id: marketing-kit-mix-keep-speech-1085
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (799b854).

- Acceptance of #1085: the window mode with no gain inside and the smallest gain outside (phase 1), the #1079
  limiter as the last step and the gate on `target ± tolerance` and `truePeak` (phases 1, 2), the log and result
  naming the measured mix and the gain (phase 2), fixture tests for two music volumes and a talk with long pauses
  (phase 2).
- Risk: a retry in keep mode must not pull the gain back toward the target point; phase 1 tests it.
- Risk: `exactOptionalPropertyTypes` with the new optional schema fields reaching `FootageFilm`; typecheck covers it.
- Default behaviour unchanged: the existing #1079 tests stay as they are.

Verdict: approved, no changes.
