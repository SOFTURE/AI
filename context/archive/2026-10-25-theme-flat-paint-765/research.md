---
change_id: theme-flat-paint-765
status: archived
---

# Research: Flat Paint theme package (issue #765)

## R1. What the kit asks of a theme

`tests/repo/themes.test.ts`: depends on `@softure-ai/theme-kit`, peers `react` and `tailwindcss ^4.0.0`, builds with
`tsc -p tsconfig.build.json && softure-theme-css`, exports `./theme.css` and each declared stylesheet, a valid
`softureTheme`, `src/tokens.ts` exports `theme` passing `checkTheme` (every shadcn colour role), and `src/index.ts`
exports `theme` and `cn`. Components are not part of the contract; theme-notion ships shadcn components because its
apps use shadcn.

## R2. The design system's tokens

The design system's `tokens.json`: 11 palette colours, 14 roles in light and dark (some as references `{lime}`),
8 position colours, 2 font families (Ubuntu, Ubuntu Mono), 16 text styles (headings, text, numbers; line heights
partly unitless, `tabular` on the mono family), 6 spacing, 7 radii, 4 sizes, 3 containers, 2 line "shadows". The
kit's `ThemeDefinition` takes scheme values or a whole-token alias, text styles without a family, sizes as one
`--spacing-*` family.

## R3. The adopting app

- Paints with the role names (`text-muted` ~500 uses, `text-accent` ~115): `muted` and `accent` are text colours
  there, not shadcn's backgrounds. Renaming them in the app is churn without a gain, since no shadcn component is in
  play.
- Uses no Tailwind default colour beyond `transparent` / `current`, which survive a cleared palette.
- Bridges `--sft-*` onto its roles on `:root`, every `[data-theme]` and its two band classes, unlayered (ui's
  defaults sit in `@layer softure`), with flat zero shadows and an ink overlay at 60 %.
- Look deltas over ui: button variants, icon button, card root/title/step, stat value, field label, switch track and
  knob, checkbox slots, segmented control.

## R4. Scheme scopes

The kit writes light on `:root, .light, [data-theme="light"]`, dark by the system unless light is asked for, and on
`.dark, [data-theme="dark"]`. A band class `dark` / `light` therefore replaces an app's own band classes; each scope
element gets its own declarations, so nesting works.
