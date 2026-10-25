# Changelog

Newest first. Each version lists what changed for an app that uses the theme. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- `TabBar` (#723): a screen's tabs as line tabs where each tab is a link (`<a href>`), so the shown tab lives in the
  address and a link, a form's return or a reload land on the same tab. Optional icon before the label and count
  after it (0 included); the current link carries `aria-current="page"`; the row scrolls sideways on a phone.
  `data-slot="tab-bar"`, `data-tab` and `data-slot="tab-bar-count"` mark the parts. An app that keeps its own copy
  replaces it with `import { TabBar } from "@softure-ai/theme-notion"`; the props are the same (`label`, `tabs`,
  `current`). For client-state tabs keep `Tabs`.

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
