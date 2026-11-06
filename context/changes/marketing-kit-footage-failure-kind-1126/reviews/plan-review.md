---
change_id: marketing-kit-footage-failure-kind-1126
verdict: approved
---

# Plan review (auto)

- Scope matches change.md and the issue: loudness (with the measured values), publishable, transient; `error` stays.
- The type change is additive for readers of `error`; code that builds a `FootageResult` failure itself now needs
  `failure` (0.x minor, noted in the CHANGELOG).
- Overlap with #1127: one import line in `isolate-ranges.ts`; told to its thread.
- Risk: a site marked `input` that is in fact transient would hide a useful retry. Only sites that validate given
  data are marked; the rest default to `process`.
- Approved.
