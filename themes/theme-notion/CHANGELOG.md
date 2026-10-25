# Changelog

Newest first. Each version lists what changed for an app that uses the theme. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- `SidePanel` (#724): a non-modal panel at a side of a canvas (a map) that leaves the canvas usable, unlike the modal
  `Sheet`. Layouts `over`, `beside`, `left`, `list`; hidden while closed, focus moves in when it opens, Escape and the
  close button call `onClose`. An app that kept its own copy replaces it with the import (same props; `closeLabel` is
  now optional, default "Close") and drops its own file.
- `PageHeader` takes `crumbsLabel` (#719): the accessible name of the breadcrumb it renders for `crumbs`, so an app
  in another language replaces the built-in English "breadcrumb". Without it the markup is unchanged.

## 0.1.1

- No change to the package itself: the first version published through the npm trusted publisher (OIDC) with
  provenance, without a token.

## 0.1.0

- First version (#708): `NOTION_THEME` (the Notion design system's tokens), `theme.css` (tokens, Tailwind
  utilities, `dark:` on the theme's scheme rule, tw-animate-css, the components as Tailwind sources), 36 shadcn/ui
  components with the Notion deltas, `Status`, `PageHeader`, `PropertyList`, `PageFrame`, `PALETTE_COLORS`,
  `ICON_STROKE_WIDTH`, `cn`, the built-in English copy with props to replace it, and `sft-bridge.css` for the pages of
  the SOFTURE packages.
- On the kit's theme package contract (#708): `theme` (the standard export, same as `NOTION_THEME`, declared with
  `defineTheme`), `softureTheme` in `package.json`, and `theme.css` built by the kit's `softure-theme-css` instead of
  a script of its own.
