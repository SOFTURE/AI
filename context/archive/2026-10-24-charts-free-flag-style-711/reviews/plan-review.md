---
change_id: charts-free-flag-style-711
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and `src/svg/flag.tsx` on master (9deab4b).

- Correctness: the free branch spreads `spanStyle` then `style`, the same order as the placed branch, so a caller's
  style still wins over the package's variable. Placed flags are untouched.
- Tests: the issue's repro (default rows), explicit `rows={1}`, `rows={2}` with a style, and the no-style case that
  guards the unchanged markup.
- Compatibility: a bug fix only; no API change.

Verdict: approved, no changes.
