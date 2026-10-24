---
change_id: themes-generic-kit-708
title: "themes: a generic theme contract in theme-kit, so a new theme needs no kit or script changes (issue #708)"
status: in_progress
roadmap_item: null
issue: 708
branch: claude/project-thread-e5uut7
created: 2026-10-24
updated: 2026-10-24
---

## Intent

Follow-up inside [issue #708](https://github.com/SOFTURE/AI/issues/708), on top of `themes-notion-708`
(PR #709, not merged yet). The owner asked that the kit be the standard way every next theme is added: one contract,
one way to define a theme, one generator, so `themes/theme-<name>` is a theme's tokens and components and nothing
else. Today a new theme copies Notion's build script (which names `NOTION_THEME` and its folders) and nothing checks
that it follows the shape.

## Outcome

- `defineTheme(definition)`: validates a theme at definition time (shadcn colour roles, names, values, aliases) and
  keeps its literal types; `checkTheme` returns the problems instead of throwing; `extendTheme(base, overrides)` builds
  a variant (another theme, or an app's own override) from an existing theme.
- The theme package contract: every `themes/theme-<name>` exports `theme` (its definition) and `cn`, declares its
  stylesheet in `package.json` (`softureTheme`: component sources, CSS imports, extra stylesheets), and builds its CSS
  with the kit's `softure-theme-css` command. No per-theme build script.
- `@softure-ai/theme-kit/build`: `buildThemeStylesheet` and `writeThemeStylesheets`, the code behind the command.
- A repository test checks every `themes/theme-*` package against the contract, so a new theme is covered without
  editing the test.
- The kit README describes the design and the steps to add a theme; the Notion theme moves onto the contract.

## Constraints

- No release (new packages; the owner's npm step comes first).
- English only; an app can still override every token (CSS variables, or `extendTheme` + `buildThemeCss`).
- No change outside `themes/`, `tests/repo/` and the root lockfile.

## Notes

- Framing: skipped. The owner named the outcome (generic, standardised addition of themes).
