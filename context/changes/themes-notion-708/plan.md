---
change_id: themes-notion-708
status: implementing
---

# Plan: shared theme packages, starting with Notion (issue #708)

Input: change.md, research.md. Complexity: medium (two new packages, no change to existing packages).

## Phase 1: workspace group and kit

Files: root `package.json` (workspace `themes/*`), `vitest.config.mts` (include `themes`), `themes/theme-kit/**`.

1. `ThemeDefinition` (colours light/dark or alias, shadows light/dark, fonts, text styles, radii, sizes,
   `clearDefaultPalette`) and `SHADCN_COLOR_ROLES`, the roles every theme defines so components move between themes.
2. `buildThemeCss(definition)`: `:root` light, dark under `prefers-color-scheme` unless `.light` / `[data-theme=light]`,
   `.dark` / `[data-theme=dark]` and `.light` / `[data-theme=light]` blocks, `@theme inline`. Rejects unsafe values.
3. `createCn({ text, shadow })`, `useIsMobile`, `preflight.css` (scoped to `[data-slot]`), `./testing` with
   `findMissingColorRoles`.
4. Tests for each; README, CHANGELOG.

## Phase 2: Notion theme

Files: `themes/theme-notion/**`.

1. `tokens.ts` (`NOTION_THEME`) equal to the snapshot `tests/fixtures/notion-tokens.json` (test).
2. `src/ui/`: 36 components, the reference app's version where it has one, the design system's files for the rest;
   relative `.js` imports; English strings from `messages/en.ts` with props; sonner without `next-themes`.
3. `src/notion/`: `Status`, `PageHeader`, `PropertyList`, `PageFrame`, palette, icon stroke.
4. Build: `tsc`, then `scripts/build-css.mjs` writes `dist/theme.css` (tw-animate-css, `@source` of the built
   components, the generated tokens) and copies `sft-bridge.css`.
5. Tests: theme CSS against the snapshot, component render tests ported from the reference app, every barrel export
   defined; README (install and wire up, theme switch, component list, adding a theme), CHANGELOG.

## Phase 3: docs

Root README layout lists `themes/`.

## Decisions (auto)

- Separate packages per theme on a shared kit rather than one package with subpaths: an app installs only its theme's
  dependencies, and a theme is released on its own.
- Folder names `theme-kit`, `theme-notion`, so the folder rule gives clear package names.
- shadcn files keep shadcn's formatting and file names, so a later `shadcn add` diff stays readable.
- Tailwind's default palette stays cleared in the Notion theme (the design system allows only its colours).

## Progress

- [x] Phase 1: theme-kit
- [x] Phase 2: theme-notion
- [x] Phase 3: root README; release-tags count 26 → 28
