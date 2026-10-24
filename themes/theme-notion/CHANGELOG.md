# Changelog

Newest first. Each version lists what changed for an app that uses the theme. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- First version (#708): `NOTION_THEME` (the Notion design system's tokens), `theme.css` (tokens, Tailwind
  utilities, `dark:` on the theme's scheme rule, tw-animate-css, the components as Tailwind sources), 36 shadcn/ui
  components with the Notion deltas, `Status`, `PageHeader`, `PropertyList`, `PageFrame`, `PALETTE_COLORS`,
  `ICON_STROKE_WIDTH`, `cn`, the built-in English copy with props to replace it, and `sft-bridge.css` for the pages of
  the SOFTURE packages.
