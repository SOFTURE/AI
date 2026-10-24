---
change_id: themes-generic-kit-708
verdict: approved
---

# Implementation review

Reviewed the branch diff over PR #709 (b6525b4) against plan.md and the owner's ask (further themes added in one
standard way).

- Contract: `checkTheme` holds every rule once (roles, names, values, aliases); `defineTheme` throws with all of them,
  `extendTheme` checks its result; `buildThemeCss` keeps its own messages, so its tests hold unchanged.
- Build: `softure-theme-css` reads `softureTheme` (narrowed from `unknown` to a result value) and the built `theme`
  export, checks the theme, writes `theme.css` and copies the stylesheets. The bin is a checked-in `.mjs`, not a file
  in `dist/`: measured, npm skipped linking a bin whose target did not exist at `npm ci`, which would break the
  theme's build in CI. With the checked-in file, a fresh `npm ci` links it and `npm run build` writes Notion's
  `dist/theme.css` and `dist/sft-bridge.css`.
- Notion: `theme` and `NOTION_THEME` are the same `defineTheme` value; its own build script is gone; the Tailwind CLI
  test now reads the package's `softureTheme`, so it tests what ships.
- Repo test: every `themes/theme-*` except the kit is checked for the kit dependency, the peers, the build command,
  `./theme.css`, a valid `softureTheme` whose folders and stylesheets exist and are exported, and a `theme` and `cn`.
- Gates: typecheck, ESLint, the language gate and `npm run build` pass; `npm test` runs in the pre-push hook.

Verdict: approved.
