---
change_id: ui-disclosure-panel-links-777
---

# Research: DisclosureMenu panel link rules (issue #777)

## Findings

- `foundation/ui/src/ui/disclosure-menu.tsx`, `PANEL_BASE`: eight `sft:[&_a]…` utilities (block, rounded-control,
  px-3, py-2, text-foreground, no-underline, hover background, focus-visible outline). They compile to
  `.sft\:[&_a]\:block a { … }`: specificity (0,1,1).
- All component utilities sit in one cascade layer, `@layer softure` (`foundation/ui/scripts/build-css.mjs`,
  `LAYER_ORDER = theme, base, softure, components, utilities`). `ButtonLink` (`button.tsx`) carries single-class
  utilities (0,1,0), so inside the panel the panel rule wins on specificity whatever the source order.
- Preflight (`a { color: inherit; text-decoration: inherit }`) lives in `base`, a lower layer, so a zero-specificity
  rule in `softure` still beats it. No other rule in `softure` targets a bare `a`.
- Tailwind v4 compiles the arbitrary variant `[:where(&_a)]` to `:where(.class a) { … }` (checked with
  `buildCss`): specificity (0,0,0). Any class rule in `softure` then wins; with nothing else on the link the panel
  rule still applies.
- Users of the panel rules: `AccountMenu` (children, footer links) and `MobileMenu` (its `link` slot) in
  `app-menus.tsx`. Neither relies on the `[&_a]` rules beating a class of its own.
- `ButtonLink` and `Button` set `data-variant`; the issue's second option (`a:not([data-variant])`) would cover only
  the package's buttons, not an app's own classed link. `:where()` covers both.
- No theme package (`themes/*`) restyles the disclosure panel.

## Options

1. `:where()` around the panel link rules: zero specificity, any classed link wins. Plain links unchanged.
2. `a:not([data-variant])`: only package buttons escape; an app link with its own classes still loses.

Recommendation: option 1.
