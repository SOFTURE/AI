# @softure-ai/ui

**Status:** wave 0 · not implemented

- **Tokens** `--sft-*` (light and dark theme), `SoftureThemeProvider`, `design.json` import
  (Impeccable), a bridge to Tailwind 4 (`tailwind.css`).
- **Theme switch:** cookie, a flicker-free boot script, `meta theme-color`.
- **Primitives:** `Button`/`ButtonLink`/`IconButton`, `Modal` (+ `ModalForm`), `Toast`, `Select` (ARIA listbox),
  `Switch`/`Checkbox`/`SegmentedControl`, fields (`TextField`, `PasswordField`, `MoneyField`, `SelectField`),
  `Card`, `Stat`, `EmptyState`, `Hint`, `ActionForm` (`useActionState`), icons, SVG chart primitives.
- Every component: `classNames` slots, `unstyled`, text and `aria-label` from `messages`,
  links through an injected `LinkComponent` (no `next/link`).

**Source in FIRE_TRACKER:** `src/components/{modal,toast,select,select-keys,switch,button,form-fields,ui,hint,icons,action-form,feedback,collapsible-section,tab-panels}.tsx`,
`src/components/chart/*`, `src/lib/{theme,chart-scale,chart-ticks}.ts`, `src/app/globals.css`, `DESIGN.md`,
architecture tests (`src/components/architecture.test.ts`, `design-tokens.test.ts`).
