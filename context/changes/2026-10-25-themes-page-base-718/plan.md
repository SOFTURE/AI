---
change_id: themes-page-base-718
status: in_progress
---

# Plan: page base and MapLibre font stylesheets (issue #718)

Input: change.md, research.md. Complexity: small (two CSS files in the kit, docs, tests).

## Phase 1: kit stylesheets

Files: `themes/theme-kit/src/base.css`, `themes/theme-kit/src/maplibre.css`, `themes/theme-kit/scripts/copy-css.mjs`,
`themes/theme-kit/package.json`, `themes/theme-kit/tests/stylesheets.test.ts`.

1. `base.css`: `@layer base { body { margin: 0; background: var(--background); color: var(--foreground);
   font-family: --theme(--font-sans); } }`.
2. `maplibre.css`: unlayered `body .maplibregl-map { font-family: --theme(--font-sans); }`.
3. Copy both to `dist/`, export `./base.css` and `./maplibre.css`.
4. Tests: base rule in `@layer base` on `body` reading only contract tokens; MapLibre rule unlayered with a selector
   more specific than `.maplibregl-map`; every `src/*.css` is copied and exported.

## Phase 2: docs

Files: `themes/theme-kit/README.md`, `themes/theme-kit/CHANGELOG.md`, `themes/theme-notion/README.md`,
`themes/theme-notion/CHANGELOG.md`.

1. Kit README: the two files in "What it holds".
2. Notion README: `base.css` in both wirings, `maplibre.css` as "if the app shows MapLibre maps"; the migration
   for an app that kept the two rules.
3. CHANGELOG entries under "Unreleased".

## Decisions (auto)

- In the kit, not in theme-notion: the rules read only contract tokens, so every theme shares them (the owner's
  rule that themes grow through the kit's contract). Theme-notion documents them.
- Opt-in files, not inside `theme.css`: an app that styles `body` itself or has no package pages sees no change.
- A separate `maplibre.css`: most apps have no map, and the rule has to be unlayered.

## Progress

- [ ] Phase 1: kit stylesheets
- [ ] Phase 2: docs
