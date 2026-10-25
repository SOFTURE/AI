---
change_id: theme-flat-paint-765
verdict: approved
---

# Implementation review

Checked: `npx vitest run themes/theme-flat-paint` 38/38, typecheck, ESLint on the package, language gate, the build
(`softure-theme-css` writes `theme.css`, `sft-bridge.css`, `page.css`).

- F1 (fixed): ESLint `no-unused-vars` on the destructured `family` in the token test; the test now picks the fields.
- F2 (kept): `page.css` declares `@theme static` (easings, default transition); it only works through the app's
  Tailwind, which the README already requires. The compiled-CSS test proves it.
- F3 (kept): `body` tracking in `@layer base`, where the reference app had it unlayered; utilities and text styles
  still override it, and ui's components set no body tracking.
- F4 (kept): the bridge is unlayered on `:root, .light, .dark, [data-theme]`, so it beats ui's `@layer softure`
  defaults on the same element, and each band recomputes it.
