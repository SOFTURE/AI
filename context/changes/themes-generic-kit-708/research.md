# Research: a generic theme contract (issue #708)

Base: `claude/project-thread-6eu3g7` (PR #709, b6525b4), which adds `themes/theme-kit` and `themes/theme-notion`.

## What is already theme-agnostic

- `ThemeDefinition` (colours light/dark or alias, shadows, fonts, text styles, radii, sizes, `clearDefaultPalette`),
  `SHADCN_COLOR_ROLES`, `findMissingColorRoles`.
- `buildThemeCss(definition)`: validates names, values and aliases while it writes, and throws on the first problem.
- `createCn`, `createThemeCn`, `useIsMobile`, `preflight.css`.

## What each theme would copy or could get wrong

- `themes/theme-notion/scripts/build-css.mjs` holds the stylesheet shape (`@import "tw-animate-css"`, `@source` per
  component folder, the generated tokens) and the build steps (load `dist/tokens.js`, read `NOTION_THEME`, write
  `dist/theme.css`, copy `sft-bridge.css`). A second theme copies and edits it; the names inside are Notion's.
- Missing shadcn colour roles surface only in a theme's own test, if the theme writes one; nothing fails at build.
- Exports are named per theme (`NOTION_THEME`), so an app cannot swap theme packages by changing the import path.
- No check that a theme package has the expected entries (`./theme.css`), depends on the kit, or names folders that
  exist. `tests/repo/packages.test.ts` checks only the generic package shape.

## Tools at hand

- Packages with commands use `"bin": { "<name>": "./dist/cli/bin.js" }` (db, blog, mailing); npm links workspace
  bins into the root `node_modules/.bin`, which `npm run` puts on `PATH`.
- Vitest resolves `@softure-ai/source`, so a repository test can import a theme's `src/tokens.ts` directly.
- Build order follows dependencies (`scripts/build-workspaces.mjs`), so the kit's `dist/` exists when a theme builds.
