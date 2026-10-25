---
change_id: theme-notion-non-text-contrast
status: archived
---

# Plan: theme-notion non-text contrast (issue #759)

Input: change.md, research.md. Complexity: small (two tokens, snapshot, four components, tests, docs).

## Phase 1: tokens, components, tests and docs

Files: `themes/theme-notion/src/tokens.ts`, `tests/fixtures/notion-tokens.json`, `src/ui/button.tsx`,
`src/ui/button-group.tsx`, `src/ui/tabs.tsx`, `src/ui/progress.tsx`, `tests/contrast.test.ts`, `README.md`,
`CHANGELOG.md`.

1. Raise the alpha of `input` (light 0.1 → 0.46, dark 0.075 → 0.36) and `control-off` (light 0.3 → 0.95, dark
   0.15 → 0.5); colour channels unchanged, so the hue stays. Snapshot fixture follows.
2. Keep the look of parts whose boundary is decoration (their text identifies them): the outline `Button` border and
   the `ButtonGroup` separator move to `border` (`#e9e9e7` / `#2f2f2f`, the same weight as the old `input`); the dark
   active tab moves to `dark:border-border dark:bg-accent/40` (the same values as before within 1 %).
3. `Progress`: the default fill is `bg-primary dark:bg-link`, applied only when no `indicatorClassName` is given, so a
   tone fill is never overridden by the dark variant.
4. `tests/contrast.test.ts`: non-text pairs at 3:1 in both schemes: `input` and `control-off` on every page surface,
   the switch thumb on its off and on track, `primary` (checked switch and checkbox) on the page, card, popover and
   muted, the progress fill against its track for the default and every tone fill.
5. README "Contrast" note and CHANGELOG `Unreleased` entry: before/after values, what an app changes (its own
   decorative `border-input` moves to `border-border`; nothing else).

## Decisions (auto)

- Raise `input` instead of a new control-boundary token: shadcn/ui's `border-input` is the field boundary, so an app's
  own fields gain 3:1 without a class change; the two decorative users move to `border`.
- Alpha only, channels kept: the borders stay translucent and tint with the surface as in the design system.
- The progress track stays quiet (research: 3:1 on both sides is impossible); the fill carries the value.
- A margin above the minimum (3.09+ on the worst surface) so a later rounding never lands on the edge.
- The tab list's selected state (light active tab on `muted`) is outside the parts the issue lists; a follow-up issue
  is filed rather than widening this change.

## Progress

- [x] Phase 1: tokens, components, tests and docs (1383346)
