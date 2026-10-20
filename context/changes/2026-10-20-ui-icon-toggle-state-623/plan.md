---
change_id: ui-icon-toggle-state-623
status: in_progress
---

# Plan: crossed-eye icon and pressed IconButton (issue #623)

Input: change.md, research.md. Complexity: small (one icon, one class constant, tests, docs).

## Goal

An app builds a "show / hide" or "only this one" toggle from `IconButton` and the icons alone, and it shows its state.

## Approach

Add `EyeOffIcon`; add an `ICON_PRESSED` class string to every `IconButton` root (only active at
`[aria-pressed="true"]`); pin `IconProps` in a type test. Rejected: a `pressed` prop (the ARIA attribute is the state,
a second prop could disagree with it); a danger-tinted pressed look (a toggle state is not a destructive action).

## Phase 1: icon, pressed look, tests

Files: `foundation/ui/src/ui/icons.tsx`, `foundation/ui/src/ui/button.tsx`, `foundation/ui/tests/icons.test.tsx`,
`foundation/ui/tests/button.test.tsx`.

1. `EyeOffIcon` after `EyeIcon`: the same eye path and pupil plus `<path d="m3 3 18 18" />`.
2. `ICON_PRESSED`: `aria-pressed:bg-accent-fill aria-pressed:text-on-accent aria-pressed:ring-1 aria-pressed:ring-inset
   aria-pressed:ring-foreground aria-pressed:not-disabled:hover:bg-accent-fill-hover
   aria-pressed:not-disabled:hover:text-on-accent`, joined into the root for both tones.
3. Tests: icon count 36 and `EyeOffIcon` carries the slash and the eye; `IconButton` root holds the pressed classes for
   both tones and passes `aria-pressed` through; `IconProps` imports from the package root.

## Phase 2: docs

Files: `foundation/ui/README.md`, `foundation/ui/CHANGELOG.md`.

1. README: icon row (36, `EyeIcon` / `EyeOffIcon`), `IconButton` pressed look in the Actions row.
2. CHANGELOG `## Unreleased`: the three points and the app's migration (drop the local icon and the `[aria-pressed]` CSS).

## Risks and rollback

A toggle that sets `aria-pressed` and relied on looking unpressed now changes look; that is the intended fix. Revert the
commits to roll back.

## Progress

- [ ] Phase 1: icon, pressed look, tests
- [ ] Phase 2: docs
