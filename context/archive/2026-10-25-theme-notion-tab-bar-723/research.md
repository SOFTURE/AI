# Research: theme-notion TabBar (issue #723)

## Current state (master f3c5ba2)

- `themes/theme-notion/src/notion/` holds the compositions (`PageHeader`, `PropertyList`, `PageFrame`, `Status`),
  each exported by name from `src/index.ts` with its props type; tests render them with `renderToStaticMarkup`.
- `src/ui/tabs.tsx` wraps Radix `Tabs` (client state, `line` variant by default).
- The reference implementation's classes all resolve to theme tokens: `h-control-height` (28 px size token),
  `text-ui-medium` and `text-small` (named text styles), `rounded-xs`, `bg-accent`, `text-muted-foreground`,
  `border-border`, `ring-ring`; `duration-120` is a stock Tailwind v4 numeric utility.
- `theme.css` lists `./notion` as a Tailwind source (`softureTheme.sources`), so a new file there is scanned with no
  build change.
- `tests/index.test.ts` checks the barrel has no undefined value and covers `ui/` files only; compositions are
  exported by hand.

## Findings

- `TabBar` fits `src/notion/TabBar.tsx` as a composition next to `PageHeader`, exported by name with `TabBar`,
  `TabBarItem`, `TabBarProps`.
- The `linkComponent` option is not needed by the adopting app (plain `<a>`); it can be added later without a break.
