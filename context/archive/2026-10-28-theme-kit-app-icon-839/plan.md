---
change_id: theme-kit-app-icon-839
status: archived
---

# Plan: app icon helper in theme-kit (issue #839)

Input: change.md, research.md. Complexity: small (one helper, one colour resolver, tests, docs).

## Phase 1: `getThemeColor` (TDD)

Files: `themes/theme-kit/src/get-theme-color.ts`, `src/index.ts`, `tests/get-theme-color.test.ts`.

`getThemeColor(theme, name, scheme = "light")`: the colour's value for the scheme, following aliases (chains
included). Throws (a bug: the theme was not checked) on an unknown name or an alias cycle, naming the colour.
Tests: plain value per scheme, alias, alias chain, unknown name, cycle.

## Phase 2: `drawAppIcon` in `./next` (TDD)

Files: `themes/theme-kit/src/next/{index.ts,draw-app-icon.tsx,next-modules.d.ts}`, `package.json` (export `./next`,
optional peer `next ^16.0.0`, dev dependency `lucide`), `tests/draw-app-icon.test.tsx`.

- `renderIconSvg(icon, color)`: the glyph as standalone SVG markup with `color` on the root (`currentColor`).
  Revised in implementation (see Decisions): the glyph is data, a lucide `IconNode` drawn with lucide's stroke
  defaults, or `{ svg }` markup; names checked, values escaped.
- `buildAppIconElement(options)`: the tree `next/og` draws: a full-size flex box in the tone's background, rounded
  (`shape: "rounded"`, radius 22 % of the side) or full bleed (`"square"`), the glyph as an `<img>` data URL at 62.5 %
  of the side.
- `drawAppIcon({ theme, icon, size = APP_ICON_SIZE, tone = "primary", scheme = "light", shape = "rounded" })`:
  `new ImageResponse(buildAppIconElement(…), size)`.
- Tones by contract roles: `primary` (primary / primary-foreground), `secondary`, `accent`, `inverse` (foreground /
  background). `APP_ICON_SIZE` 32 × 32, `APPLE_ICON_SIZE` 180 × 180.
- Tests: element colours for every tone (a value theme and an alias theme), square vs rounded, the exact markup of
  lucide's `Wallet`, nested children and dropped keys, escaping, refused names and non-SVG markup, and `drawAppIcon`
  returning a PNG with the requested width and height (IHDR).

## Phase 3: docs

`themes/theme-kit/README.md` (export table row and an "App icon" section with `app/icon.tsx` / `app/apple-icon.tsx`),
`CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- theme-kit, not theme-notion: generic through the contract (owner's rule); the helper takes the theme as an argument.
- A `./next` subpath keeps `next` out of the kit root; `next` is an optional peer.
- The glyph is data, not a React element (changed during phase 2). The L-002 proof (`next build` of a scratch app
  with `app/icon.tsx` and `app/apple-icon.tsx`) showed both element routes fail: lucide-react's icons are client
  modules in a metadata route ("Attempted to call the default export of …/Icon.mjs from the server"), and Next
  refuses `react-dom/server` in app code. lucide's framework-free package `lucide` exports the same icons as
  `IconNode` data, so `drawAppIcon` draws that (plus `{ svg }` markup for other sets); the issue's lucide hook
  problem is solved by not calling components at all.
- The issue's `side` became `size` (`{ width, height }`), the shape Next's `size` export already has, so an icon file
  passes the same constant to both.
- Colours default to the light scheme: a favicon is one PNG for both schemes.
- The glyph is coloured through the root `color` attribute, so any `currentColor` icon set works without props of its
  own.
- No change to the design system artifact: theme-notion's visuals do not change.
- No version bump: the coordinator releases.

## Progress

- [x] Phase 1: getThemeColor, 1a008f4
- [x] Phase 2: drawAppIcon, e923120. Proof: `next build` (16.3.8, Turbopack) of a scratch app on the packed kit and
  theme-notion prerenders `/icon` (32 × 32, rounded, `#0171cf` with a white wallet) and `/apple-icon` (180 × 180, full
  bleed); pixels checked.
- [x] Phase 3: docs, 0363621
- [x] Implementation review: approved
