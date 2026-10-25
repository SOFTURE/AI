---
change_id: theme-notion-stat-progress-739
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and issue #739.

- API matches the issue: `progress?: number`, `progressLabel?: string` on `StatCard`, both documented.
- No markup change without `progress`: the existing exact-markup tests pass untouched, and a new test pins the card's
  `<div class="min-w-0">` and the absence of a progress bar.
- The bar: package `Progress` (`h-1.5`), under the figure and above the hint, `aria-valuenow` from the clamped value,
  `aria-label` = `progressLabel ?? label`, fill `TONE_FILL[tone]` with a tone, primary without.
- Clamping covers below 0, above 100 and NaN; both `aria-valuenow` and the indicator transform follow it.
- `Progress` fix (value to the root) is additive for callers; covered by `tests/ui/progress.test.tsx`.
- README and CHANGELOG (Unreleased) describe what an app changes. English only.

Verdict: approved, no changes.
