---
change_id: theme-notion-top-loading-bar-923
status: archived
---

# Plan: top loading bar (issue #923)

Input: change.md, research.md. Complexity: medium (two packages, one self-contained script).

## Phase 1: pwa counter drives any root (TDD)

Files: `modules/pwa/src/launch/launch-progress.ts`, `src/launch/script.ts`, `tests/launch-progress.test.ts`,
`tests/support/fake-launch-page.ts`.

- `LaunchProgressConfig.rootSlot?` (default `launch-screen`); `LaunchProgressOptions.rootSlot` checked as a slot name
  (`^[a-z][a-z0-9-]*$`); the percent slot is `<rootSlot>-percent`.
- Each shown value also writes `data-state="loading"` on the bar and its indicator, so an indeterminate bar turns
  determinate.
- Tests: a `top-loading-bar` root is driven; the default still finds `launch-screen`; a script outside the named root
  does nothing; a bad slot name throws; state written.

## Phase 2: theme-notion indeterminate Progress, TopLoadingBar, RouteLoading

Files: `themes/theme-notion/src/ui/progress.tsx`, `src/notion/TopLoadingBar.tsx`, `src/notion/RouteLoading.tsx`,
`src/index.ts`, tests, gallery cases, parity fixture, visual baselines.

- `Progress` without a value: no inline transform; indicator a third wide sliding across forever; reduced motion shows
  a still, full, half-opaque fill.
- `TopLoadingBar({ label, value?, script?, className })`: fixed top, full width, 2 px, square, transparent track,
  `pointer-events-none`, `z-50`.
- `RouteLoading({ name, iconSrc, label, launchScript?, barScript? })`: both, CSS picks.

## Phase 3: docs

Both READMEs and `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Option 1 of the research; the breakpoint is `md` (48rem), the theme's phone/desktop line elsewhere.
- The bar is 2 px (`h-0.5`), filled like `Progress` (primary, the link blue in dark).
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: counter root slot (c278f5b)
- [x] Phase 2: theme components (08b5c6d)
- [x] Phase 3: docs (abe1bd5)
- [x] Implementation review
