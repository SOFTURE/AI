---
change_id: themes-page-base-718
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and issue #718.

- Ask 1 (body rule): `themes/theme-kit/src/base.css`, `@layer base`, only `body`, reads `--background`,
  `--foreground` (contract roles) and `--theme(--font-sans)`. Compiled by the real Tailwind CLI after Notion's
  `theme.css` in `themes/theme-notion/tests/theme-css.test.ts`: the font resolves to the Notion sans stack.
- Ask 2 (MapLibre): `themes/theme-kit/src/maplibre.css`, unlayered `body .maplibregl-map`, family only; the compiled
  output keeps it at top level (unlayered).
- Shipping: both copied by `scripts/copy-css.mjs` and exported; `tests/stylesheets.test.ts` fails if a `src/*.css`
  is not copied or exported. `npm run build -w @softure-ai/theme-kit` writes all three to `dist/`.
- Docs: kit README table and import note, Notion README both wirings and the migration, both CHANGELOGs under
  `Unreleased`.
- Release note for the coordinator: kit gains exports (patch keeps `^0.1.0` in theme-notion satisfied); theme-notion
  changes only its README.

Verdict: approved.
