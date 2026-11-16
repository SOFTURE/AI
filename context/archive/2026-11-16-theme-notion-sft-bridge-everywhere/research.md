# Research: theme-notion-sft-bridge-everywhere

## Question

Should theme-notion re-point ui's `--sft-*` tokens outside `PageFrame` too, and how, without breaking the cascade
against ui's own defaults?

## Findings

- `themes/theme-notion/src/sft-bridge.css` declares the `--sft-*` aliases on `[data-page-frame]` inside `@layer base`.
  Its comment gives the reason for the scope: "screens still on `--sft-*` keep their look until they move". Inside a
  theme-notion app there is no screen that should keep ui's default look: every ui component (fields, cards, modals,
  toasts, the coming chat primitives) is meant to look like the theme. The concept check (#1248, research section 4)
  found exactly this: the chat in a `PageFrame` took the theme; the legal footer outside it kept ui's defaults.
- ui writes its defaults in `@layer softure` (`foundation/ui/src/theme/theme-css.ts`, layer order
  `theme, base, softure, components, utilities`) on `:root`, `[data-theme="light"]`, `[data-theme="dark"]` and the
  `prefers-color-scheme` variants of `:root`. A Notion alias on `:root` inside `@layer base` would lose to
  `@layer softure` on the same element; it works today only because `[data-page-frame]` is a different, deeper
  element. Moving the scope to the root therefore needs the aliases outside the layers (unlayered beats every layer).
- theme-flat-paint already does this (`themes/theme-flat-paint/src/sft-bridge.css`): unlayered, on
  `:root, .light, .dark, [data-theme]`. The reason it gives holds for Notion too: a custom property holding `var()`
  resolves on the element that declares it and children inherit the result, so an alias on `:root` alone would
  freeze the light values inside a `.dark` band. theme-kit writes the Notion scheme values on `:root`, `.light`,
  `[data-theme="light"]`, `.dark`, `[data-theme="dark"]` (`themes/theme-kit/src/build-theme-css.ts`), so the same
  selector list re-resolves on every scheme scope.
- `PageFrame` stays a target: a frame inside a scheme band keeps working, and its `body:has([data-page-frame])` rule
  (no margin, the Notion background) stays as it is, in `@layer base`.
- An app that overrides an `--sft-*` token itself does so after the import, unlayered, so its rule still wins by order.

## Options

- **A (recommended).** Apply the bridge on every scheme scope plus `[data-page-frame]`, unlayered, like flat-paint.
  One rule for both themes; ui screens anywhere take the theme.
- B. Document that a ui screen sits in a `PageFrame`. Rejected: `PageFrame` is a full-window page (`min-h-dvh`, safe
  area padding), not a panel; a chat beside the app shell's sidebar cannot use it.
- C. A new opt-in attribute (`[data-sft-bridge]`). Rejected: one more thing every app must remember, and the default
  stays wrong.

## Evidence plan

- Unit test: the bridge's selector list and that the alias block sits outside `@layer`.
- Browser test (Playwright, the theme's visual suite): computed `--sft-*` values and painted colours of ui components
  outside a frame, inside a frame and inside a nested `.dark` band, both schemes.
- Visual baselines and axe of ui's chat primitives (#1259) outside a `PageFrame`, light and dark.
