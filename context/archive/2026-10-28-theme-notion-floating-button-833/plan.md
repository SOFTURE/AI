---
change_id: theme-notion-floating-button-833
status: archived
---

# Plan: theme-notion opaque floating Button (issue #833)

Input: change.md, research.md. Complexity: small (one component, its tests, docs, the design system).

## Phase 1: the component and its tests

Files: `themes/theme-notion/src/ui/button.tsx`, `tests/ui/button.test.tsx`, `tests/gallery/cases.tsx`,
`tests/fixtures/notion-slots.json`.

1. `outline`: keep `bg-background`; hover paints the accent as a gradient layer
   (`hover:bg-linear-to-r hover:from-accent hover:to-accent`) instead of `hover:bg-accent`, so the background colour
   stays opaque.
2. New `floating` variant: `bg-background text-foreground shadow-menu`, the same hover layer, an `aria-expanded`
   layer in `accent-strong`, `disabled:opacity-100 disabled:text-muted-foreground disabled:shadow-none`.
3. Tests: outline and floating never set a translucent `background-color` on hover (no `hover:bg-accent*`); the
   floating classes; the `aria-expanded` layer; disabled stays opaque (the caller's `disabled:opacity-50` merged out).
   A computed-style check in the browser suite is not available for buttons, so the class contract is the test.
4. `CVA_AXES.buttonVariants.variant` gains `floating`; regenerate the parity fixture.

## Phase 2: docs

`themes/theme-notion/README.md` (button deltas, when to use `floating`), `CHANGELOG.md` (`Unreleased`).

## Phase 3: design system

Patch the "NOTION · Design System" artifact's `bundle.js` (the `buttonVariants` class strings), rebuild or patch
`bundle.css` for the new classes, add a floating button to the Button preview and the `index.d.ts` variant union;
render-check in light and dark over an image.

## Decisions (auto)

- The variant over opaque tokens (research, option 2 rejected).
- `outline` fixed in place as well: same pixels on the page, opaque over content.
- No version bump: the coordinator releases in a batch.

## Progress

- [x] Phase 1: the component and its tests (acfcba14, theme-notion tests 831/831)
- [x] Phase 2: docs (7dd0ad3e)
- [x] Phase 3: design system (artifact versions 25-26, no repository commit)
