---
change_id: ui-menus-color-presets-558
reviewed: 2026-10-17
verdict: approved
---

# Implementation review: ui-menus-color-presets-558

Reviewed: the branch diff against plan.md, change.md and issue #558.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | `AccountMenu.trigger` only replaces the icon node; the name stays the `aria-label` from `appShell.accountMenu`. | No change. |
| 2 | Check | The leave keeps the panel shown with `data-state="closed"` and `pointer-events-none`; a re-open cancels the hide; reduced motion (0s) hides at once; a missing `transitionend` hides after the timeout. All tested. | No change. |
| 3 | Check | `modal.tsx` only lost the moved helpers; its tests pass unchanged. | No change. |
| 4 | Check | A flat `MobileMenu` renders the exact markup of 0.3.2 (string-equality test). | No change. |
| 5 | Minor | The architecture test bans native `title` tooltips; the first draft of the swatches had one. | Removed; the swatch's name is its `aria-label`. |
| 6 | Check | The swatches' `backgroundColor` is the app's data, not a raw design colour; commented in place. | No change. |
| 7 | Check | The compiled `styles.css` contains every new class (`starting:`, `data-[state=closed]:`, `aria-checked:ring-*`, `first:border-t-0`). | No change. |
| 8 | Check | CHANGELOG `## Unreleased` with the migration, README updated, no version bump (batched releases). | No change. |
