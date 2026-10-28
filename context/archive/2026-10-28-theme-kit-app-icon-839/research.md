---
change_id: theme-kit-app-icon-839
---

# Research: app icon helper (issue #839)

## What exists

- `themes/theme-kit` holds the theme contract (`ThemeDefinition`, `SHADCN_COLOR_ROLES`), with subpaths `.`, `./react`
  and `./build`. Its only peer is `react`. No subpath imports `next`.
- Colours are `{ light, dark }` or `{ alias }`; `checkTheme` only checks that an alias target exists. theme-notion's
  `primary` is a value (`#0171cf` / `#ffffff`), theme-flat-paint's `primary` and `primary-foreground` are aliases
  (`accent-fill`, `on-accent`). So a helper must resolve aliases, possibly chained.
- `@softure-ai/blog/next` already draws with `next/og` (`og-image.tsx`): `new ImageResponse(<div style>…)`, bare
  `next/og` import typed through `src/next/next-modules.d.ts` (lessons L-002). Root dev dependencies hold `next`
  16.3.8 and `react-dom` 19.3; `lucide-react` 1.61 is hoisted from theme-notion.
- Probe (vitest, node): `renderToStaticMarkup(<Wallet />)` from lucide-react 1.61 gives a standalone
  `<svg xmlns=… stroke="currentColor" …>`; an `ImageResponse` with that markup as an `image/svg+xml` data URL inside
  `<img>` renders a PNG in the test runner. `currentColor` in a standalone SVG reads the root's `color` attribute
  (an SVG presentation attribute), so injecting `color="<token>"` on the root colours the glyph.
- Next.js metadata files: `app/icon.tsx` and `app/apple-icon.tsx` export a default function returning an
  `ImageResponse`, plus `size` and `contentType`. iOS masks the apple icon itself, so it should be full bleed.

## Options

1. theme-notion helper: simple, but theme-flat-paint and every later theme would copy it. Rejected (the owner wants new
   themes to come in generically through the contract).
2. theme-kit `./next` subpath taking a `ThemeDefinition`: one helper for every theme; root `getThemeColor` resolves a
   colour role for a scheme. Chosen.
