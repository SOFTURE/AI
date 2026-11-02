---
change_id: theme-notion-top-loading-bar-923
verdict: approved
---

# Implementation review

Reviewed c278f5b..abe1bd5 against plan.md and issue #923.

- Ask 1: `TopLoadingBar` (2 px, square, transparent track, `pointer-events-none`, fixed top, `z-50`) and an
  indeterminate `Progress` (keyed on Radix's `data-state`, no inline transform without a value). Checked in Chromium on
  the built gallery: the fill animates at 1440 px, stands still full and half-opaque with reduced motion.
- Ask 2: `rootSlot` option, validated as a slot name, carried into the served text (tested from the built text); the
  counter writes `data-state="loading"` so the indeterminate bar turns determinate on its first value, and stays
  indeterminate before it.
- Ask 3: `RouteLoading` streams both; one stacked media rule each (`md:[@media(display-mode:browser)]:…`), so no two
  display rules compete on order. Chromium: launch screen `none` and bar `block` at 1440 px, the reverse at 390 px.
- `Progress` with a value: unchanged pixels (gallery baseline untouched); fixture, upstream deltas and the Stats test
  updated for the longer class list.
- Gallery cases, parity fixture and 8 visual baselines added; READMEs and both `## Unreleased` changelog entries.
- Not done here: the design system artifact (a separate thread syncs it).

Verdict: approved.
