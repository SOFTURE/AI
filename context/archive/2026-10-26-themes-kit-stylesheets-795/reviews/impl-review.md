---
change_id: themes-kit-stylesheets-795
verdict: approved
---

# Implementation review

- Plan conformance: both phases done as planned; no deviation.
- Contract: the re-exports are written by `softure-theme-css` for every theme and `tests/repo/themes.test.ts`
  requires the three exports from every `themes/theme-*`, so a new theme gets them by being created.
- Resolution: the Tailwind CLI test compiles an app that imports `@softure-ai/theme-test/<name>.css` with the kit
  only in the theme's nested `node_modules`; the kit's rules come out and no `@import` is left.
- Built output checked by hand: `npm run build -w @softure-ai/theme-flat-paint` writes the three one-line files.
- Compatibility: the kit keeps its own `./*.css` exports; an app on the old imports keeps working. The themes' kit
  ranges (`^0.1.2`, `^0.1.3`) already export all three files, so the theme releases need no kit bump to work.
- Design Notion: no visual change (the kit's rules are untouched); the NOTION · Design System artifact needs no sync.
- Language gate, links test, typecheck and lint pass; full `npm test` runs in the pre-push hook.

## Before the next release

- Release theme-kit with the themes (minor-safe patch: `/build` gains exports), so an outside theme built with
  `softure-theme-css` gets the re-exports too.
