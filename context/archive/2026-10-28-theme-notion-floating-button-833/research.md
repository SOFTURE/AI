---
change_id: theme-notion-floating-button-833
---

# Research

- `buttonVariants.outline` is `border border-border bg-background hover:bg-accent hover:text-accent-foreground`.
  `--accent` is `rgba(55, 53, 47, 0.08)` light and `rgba(255, 255, 255, 0.055)` dark, so the hovered background
  colour has alpha 0.08 / 0.055: confirmed, matches the issue's measurement.
- No variant has an `aria-expanded` state; `secondary` uses `hover:bg-accent-strong` (also translucent, but its
  rest fill `bg-secondary` is translucent too, so it is a page-surface button by design).
- Tailwind v4 (checked with the theme's design system): `bg-linear-to-r from-accent to-accent` compiles to a
  `background-image` gradient of the token, which paints over `background-color` without replacing it. In the emitted
  CSS `aria-expanded:` rules come after the `hover:` block, so an open, hovered button shows the pressed tint.
- `shadow-menu` is the theme's floating-surface shadow (menus, popovers, `SidePanel`); `cn` merges theme shadows.
- `disabled:opacity-50` on the base makes a disabled button translucent as a whole: a floating disabled button would
  show the map through it.
- The gallery renders every `buttonVariants` combination from `CVA_AXES` (tests compare it with the sources); the
  parity fixture `tests/fixtures/notion-slots.json` pins each case's classes and is regenerated with the update flag.
  The visual baselines cover overlays only, not buttons.

## Options

1. A `floating` variant: opaque `bg-background`, `text-foreground`, `shadow-menu`, no border, the tint as a gradient
   layer on hover (`accent`) and `aria-expanded` (`accent-strong`), disabled shown with muted text at full opacity.
   Chosen: the issue's first proposal; one class list, no new tokens.
2. Opaque tokens (`--accent-opaque`, `--accent-strong-opaque`). Rejected: a pre-mixed opaque grey is right only over
   `--background`, adds four token values to keep in sync with the design system, and the gradient layer gives the
   same pixels with the existing tokens.
3. Also fix `outline`: the same gradient layer on hover instead of `hover:bg-accent`. Over the page it renders the
   same pixels (accent over background either way), and over a map it stops going see-through. Chosen together with 1:
   the issue's title is the outline defect.
