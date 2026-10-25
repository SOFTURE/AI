---
change_id: theme-notion-stat-progress-739
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and issue #739.

- Scope: one optional field pair on `StatCard`, one additive prop on `Progress`, tests and docs; no other package.
- Acceptance: unchanged markup without `progress` is guarded by the existing exact-markup tests; the new tests cover
  rendering only when given, `aria-valuenow`, tone colour and clamping.
- Risks: Radix drops `aria-valuenow` for out-of-range values; clamping before passing the value covers it. `TONE_FILL`
  classes are literal, so Tailwind generates them (`./notion` is a source).
- Layout: `flex-1` on the left column only with a bar keeps the old markup byte-for-byte for other cards.

Verdict: approved, no changes.
