---
change_id: theme-notion-floating-button-833
verdict: approved
---

# Implementation review

- Plan conformance: the three phases done as planned; no deviation.
- `outline`: `hover:bg-accent` replaced by `hover:bg-linear-to-r hover:from-accent hover:to-accent`; the background
  colour stays `bg-background` on hover. The upstream delta for the variant block is updated and the upstream guard
  passes.
- `floating`: `bg-background text-foreground shadow-menu`, hover `accent` layer, `aria-expanded` `accent-strong`
  layer, disabled at full opacity with muted text and no shadow (`cn` merges the base `disabled:opacity-50` out,
  asserted). No border.
- Measured in Chromium with the rebuilt design-system CSS, over a striped "map": the hovered and pressed buttons keep
  `background-color` `rgb(255, 255, 255)` (light) and `rgb(25, 25, 25)` (dark), alpha 1, with the tint as a
  `background-image` (0.08 / 0.16 light, 0.055 / 0.1 dark); before the change the outline's hovered alpha was 0.08 /
  0.055 as the issue measured. An open, hovered floating button shows `accent-strong` (`aria-expanded:` rules come
  after `hover:` in the emitted CSS).
- Tests: three new button tests fail without the change (no `floating` variant, `hover:bg-accent` on outline). The
  gallery's `CVA_AXES` lists `floating`, so the matrix, tailwind-classes and contrast suites render all eight sizes;
  the parity fixture is regenerated (only the outline hover classes and the new floating cases changed).
- Design Notion: `bundle.js` patched in place (the two `buttonVariants` strings) on top of #832's published version,
  `bundle.css` rebuilt with the recorded recipe plus the published sheet's own class list, so nothing it had is lost
  (diff: only the new utilities and the preview's layout classes). Button preview shows floating buttons and an
  outline button over a striped map, render-checked in light and dark, no console errors; README and `index.d.ts`
  list `floating`.
- Gates: typecheck, lint, language gate on every commit; theme-notion tests 831; full `npm test` in the pre-push hook.

## Before the next release

- Nothing beyond the coordinator's batch release of theme-notion (minor: a new variant; the outline change is
  visual only).
