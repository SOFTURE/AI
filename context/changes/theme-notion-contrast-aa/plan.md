---
change_id: theme-notion-contrast-aa
status: in_progress
---

# Plan: theme-notion WCAG AA contrast (issue #756)

Input: change.md, research.md. Complexity: medium (tokens, snapshot, five components, tests, docs).

## Phase 1: tokens and components

Files: `themes/theme-notion/src/tokens.ts`, `tests/fixtures/notion-tokens.json`, `src/ui/button.tsx`,
`src/ui/badge.tsx`, `src/ui/tabs.tsx`, `src/ui/sidebar.tsx`, `src/ui/alert.tsx`, `README.md`, `CHANGELOG.md`.

1. Shift the failing tokens in OKLCH lightness only (light darker, dark lighter):
   `muted-foreground`/`gray`, `primary`/`sidebar-primary`, `primary-hover` (keeps its step below `primary`),
   `destructive`, the light palette text colours, dark `purple`, `pink`, `red`, dark `yellow-tag`, `ring` and
   `sidebar-ring` (opacity raised to 3:1).
2. Add a `link` colour: light equal to `primary`, dark a lighter blue. The link variants of `Button` and `Badge` and
   the hovered inline links (`Empty`, `Item`, `Field`) use `text-link`.
3. `Button` destructive in dark: `dark:bg-destructive/60` and a dark hover `/50`, as shadcn/ui's badge; `Badge`
   destructive hover in dark likewise; `Badge` default hover uses `primary-hover` instead of `primary/90`.
4. Opacity-faded text becomes `text-muted-foreground`: tab triggers, sidebar group label; the destructive alert's
   description is `text-destructive`.
5. Snapshot fixture follows the tokens (with the new `link`); README token notes and CHANGELOG `Unreleased` entry
   with the before/after values and what an app changes (a hard-coded `#2383e2` or `text-primary` on dark text).

## Phase 2: contrast test

Files: `themes/theme-notion/tests/contrast.test.ts`.

1. A test that computes every pair the parts render (light and dark, alpha composited) and asserts each reaches
   4.5:1 (3:1 for the ring), so a later token change cannot drop below AA. Issue #741 extends it with axe.

## Decisions (auto)

- A new `link` token rather than one blue: in dark no single value passes both under white text and on dark
  surfaces (research). `primary` stays the fill with white text, as shadcn/ui reads it.
- Dark destructive follows shadcn/ui's `/60` fill rather than a second red token.
- `gray` stays equal to `muted-foreground` in each scheme, as in the design system.
- Margin target 4.55 so hex rounding and the #741 thresholds never sit on the edge.
- Non-text contrast of input borders and the switch's off track is out of scope (the issue and #741's axe run cover
  text and the focus ring); noted for the coordinator.

## Progress

- [ ] Phase 1: tokens and components
- [ ] Phase 2: contrast test
