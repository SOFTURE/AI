# Research: theme-notion test suite (issue #741)

## Current state (master e6d049c)

- `themes/theme-notion/src/ui/` holds 36 shadcn new-york v4 files, `src/notion/` the compositions (`Status`,
  `PageHeader`, `PropertyList`, `PageFrame`, `DetailTable`, `FoldRow`, `MarkPopover`, `SidePanel`, `Stats`,
  `TabBar`, tones). Tests: tokens vs `tests/fixtures/notion-tokens.json`, `theme.css` compiled by the real Tailwind
  CLI (`tests/theme-css.test.ts`), the barrel (`tests/index.test.ts`, counts 36 ui files), the compositions, and
  five ui files (alert, badge, button, table, tabs) with `renderToStaticMarkup`.
- The ui files keep upstream's formatting (no semicolons, double quotes). A line diff against the shadcn registry
  sources at `shadcn-ui/ui@617134d` (`apps/v4/registry/new-york-v4/ui/*.tsx`, MIT) shows only small hunks per file:
  the import paths (`cn`, sibling parts), the Notion sizes, radii, shadows and focus rings, the message-layer props,
  the sidebar's controlled cookie and stable skeleton width, and the four drifts of #735. `collapsible.tsx` equals upstream;
  `sidebar.tsx` has the most (66 changed lines).
- The registry host (`ui.shadcn.com`) is blocked from the container; `raw.githubusercontent.com` at a commit SHA is
  reachable, so the pinned sources can be fetched once and committed.
- Root devDependencies already hold `happy-dom`, `@testing-library/react`, `@testing-library/dom`, `esbuild`,
  `@tailwindcss/cli`, `tailwindcss`; `@playwright/test` 1.63 and `playwright` are installed through
  `@softure-ai/testing` and `marketing-kit`. Missing: `@vitest/coverage-v8`, `@axe-core/playwright`.
- Vitest runs one root config (`vitest.config.mts`, `environment: node`); DOM tests opt in per file with
  `// @vitest-environment happy-dom` (as `SidePanel.test.tsx`, `foundation/ui`).
- CI (`ci.yml`) runs `npm test` on ubuntu with `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/google-chrome` for marketing-kit;
  `e2e.yml` runs the example app. No job runs anything only for `themes/`.
- The container's Chromium is Playwright's own build 1243 (`/opt/pw-browsers`), the one `npx playwright install
  chromium` fetches for 1.63, so baselines taken here match a CI job that installs the same build. Fonts differ
  between hosts (the theme's system sans stack resolves to whatever the host has).
- Contrast of the design system's text tokens (WCAG 2): `foreground` on `background`/`muted`/`sidebar` 12.3/11.4
  light, 11.9/11.0 dark; `sidebar-foreground` ≥ 5.9; `muted-foreground` light is 4.48 on `background` and 4.17 on
  `muted`/`sidebar` (below AA 4.5), dark ≥ 5.9. `primary` (#2383e2) behind white text is about 3.9. These are
  Notion's own values (the token snapshot).

## Findings

- An upstream delta guard as data is simple and exact: per file, an ordered list of `{ upstream, ours, reason }`
  replacements; applying them to the pinned upstream text must give the package file byte for byte, and each
  `upstream` string must occur exactly once. The #735 drifts are not on the list, so the guard fails on them; a test
  can re-introduce each drift into the fixed source and assert the guard reports it.
- One list of gallery cases (every export, every `variant` × `size`, portalled parts open) can serve layers 1, 2, 5
  and 6: render in happy-dom, collect `data-slot` → class list into the parity fixture; the union of fixture
  classes is what Tailwind must generate; the same cases, bundled with esbuild, make the visual gallery page.
- Tailwind v4's `compile()` from `tailwindcss` builds CSS for a candidate list, so each class can be checked to
  produce a rule; marker classes (`group`, `peer`, `group/*`, `peer/*`) produce none by design.
- Visual baselines need a host-independent font: the gallery page sets the sans and mono font to files shipped in
  npm packages (`@fontsource`), so the container and the CI runner rasterise the same glyphs.
- The light `muted-foreground` and the white-on-`primary` contrast fail AA in the design system itself; axe's
  `color-contrast` rule would fail on any page using them. Changing the tokens changes the design system.
