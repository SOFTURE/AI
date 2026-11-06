# @softure-ai/theme-flat-atlas

The Flat Atlas design system as a package: passport paper, flat land and one stamp ink, for travel sites and anything
that stands on a map. A sibling of [`@softure-ai/theme-flat-paint`](../theme-flat-paint/README.md) (the same flat
material, role structure and component discipline, another world), built on
[`@softure-ai/theme-kit`](../theme-kit/README.md). It ships the tokens, the page base and its own React components,
the world map among them. It needs no `@softure-ai/ui`.

## Install and wire up (Vite + React)

```bash
npm i @softure-ai/theme-flat-atlas tailwindcss @tailwindcss/vite
```

```css
/* src/index.css */
@import "tailwindcss";
@import "@softure-ai/theme-flat-atlas/theme.css"; /* tokens, utilities, dark:, the components as a source */
@import "@softure-ai/theme-flat-atlas/base.css";  /* body on the theme's background, text colour and font */
@import "@softure-ai/theme-flat-atlas/page.css";  /* scheme, tracking, lining numerals, motion, reduced motion */
```

```html
<!-- index.html: light is the primary scheme; without this the tokens follow a dark system setting -->
<html lang="en" data-theme="light">
```

**Fonts.** The theme names `Calistoga` (headings and the country count, one weight, 400), `Raleway` (text, labels,
buttons, the wordmark; 400 to 700) and `DM Mono` (coordinates and ISO codes only). All three are on Google Fonts under
the OFL with the `latin-ext` subset:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Calistoga&family=Raleway:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" />
```

A Next.js app imports the same stylesheets in `app/globals.css` and points `--font-sans`, `--font-display` and
`--font-mono` at its `next/font` variables in an `@theme inline` block after them.

```tsx
import { Button, CountryChip, CountryCounter, SiteHeader, Wordmark, WORLD_COUNTRY_TOTAL } from "@softure-ai/theme-flat-atlas";
import { WorldMap } from "@softure-ai/theme-flat-atlas/world-map";

<SiteHeader brand={<Wordmark href="/" name="Example" suffix=".com" mark={<img src={logo} alt="" />} />} />
<CountryCounter value={12} total={WORLD_COUNTRY_TOTAL} unit={t.countries(12)} totalLabel={t.ofTotal} label={t.counterLabel(12)} />
<WorldMap label={t.mapLabel} countries={{ "620": "visited", "764": "planned" }} places={places} />
<Button variant="primary">{t.readBlog}</Button>
```

Every visible text and accessible name is a prop: the components carry no copy, so the app's message layer decides the
language and the plural forms.

## Rules, in short

- Components paint with **roles** only: `background`, `surface`, `surface-raised`, `border`, `line-strong`,
  `foreground`, `muted`, `accent`, `accent-fill`, `accent-fill-hover`, `on-accent`, and the map roles `map-ocean`,
  `map-land`, `map-edge`, `visited`, `place`, `planned`, `pin-stroke`. The palette (`stamp`, `passport`, `marigold`,
  `passport-paper`, `ink`, `night`, …) feeds them. Tailwind's default palette is cleared.
- **Light first.** Every view stands on passport paper (`#F3F8F3`), the hero and the map included. The dark scheme
  ("passport cover", `#141A2E`) exists in the tokens; no view needs it.
- **The stamp ink is paint** (`accent-fill`, `#BA0E56`): a visited country, the `primary` button, the counter's flag, a
  pin's flag, an ISO code. Text on it is always white (6.4:1). As text on paper it holds 5.95:1, so links and accent
  text may be stamp ink.
- **Three meanings on the map, each with a second carrier:** `visited` (the country painted in stamp ink), `place`
  (a marigold pin with a 2 px ink stroke and a white centre: the stroke turns 2.75:1 into 7:1), `planned` (a dashed
  passport-blue outline drawn above its neighbours, and a passport-blue pin with the same ink stroke: a plan is never
  painted). Blue and marigold are data colours: never a button or
  a card, and marigold is never text on paper.
- **Flat, no exceptions**: depth is `background` → `surface` → `surface-raised` and one 1 px `border`. No shadows,
  glows, gradients or blur, the map included: the ocean is one colour, pins have no halo. The only "shadow" in the
  system is a pin's stroke.
- At most one `primary` button and one `hero` number per screen.
- **Type**: Calistoga for headings (`text-display`, `text-headline`, `text-section`, `text-subsection`, with
  `font-display`), Raleway for text (`text-body` 17 px, `text-body-sm`, `text-label`, `text-caption`), DM Mono for
  `text-coord` and `text-iso`. One tracking, 0.02em, everywhere; numbers take 0 (`num`, `text-hero`) and the wordmark
  0.1em. Raleway's digits are old-style by default, so `page.css` turns on lining numerals. Titles are sentences; no
  uppercase eyebrows over headings; capitals only in ISO codes, coordinates and the wordmark.
- **Space and shape**: phone first (390 px); page margin 16 / 24 / 48 px; content `max-w-site` (90 rem), paragraphs
  `max-w-measure` (40 rem); sections `mt-section` (96 px). Radii `rounded-card` 16 (card, postcard, popover),
  `rounded-control` 10 (button, field), `rounded-tag` 4 (pin flag, label), `rounded-pill`. Strokes are 1 px, dashed
  only for a plan. Touch targets at least 40 px.
- **Motion**: `--duration-fast` 160 ms (hover, focus, a pin growing), `--duration-base` 220 ms (a pin's popover),
  `--duration-slow` 320 ms (a country's first paint); easings `ease-out-soft`, `ease-out-snap`. Nothing overshoots; a
  pin grows to `scale(1.25)` on hover and nothing else grows; the still state is the final state, and
  `prefers-reduced-motion: reduce` stops it all.
- **Focus**: a 2 px `accent` outline 2 px off the element; a pin takes it 2 px off its dot. Tab visits the pins in the
  order the app gives them (chronological).
- **Content**: no emoji and no flag emoji; a country carries its ISO code. The map always has the list of countries
  as text beside it.

## Components

| Export | What it is |
| --- | --- |
| `Button` (`size` `sm` 32 / `md` 40 / `lg` 52, `variant` `primary` / `secondary` / `ghost` / `ink`), `getButtonLook(size, variant)` | One button: the size gives the dimensions, the variant only the colours. `getButtonLook` puts the same look on a link or a router link |
| `IconButton` (`aria-label`, `isBordered`) | A 40 px button with only an icon |
| `SiteHeader` (`brand`, `variant` `over-map` / `solid`, children as the right slot) | The 64 px header: transparent on the hero, solid with a hairline on subpages |
| `Wordmark` (`href`, `mark`, `name`, `suffix`), `WORDMARK_LOOK` | The project's logo (44 px) and name in Raleway capitals at 0.1em, as one link; the logo belongs to the project |
| `CountryCounter` (`value`, `total`, `unit`, `totalLabel`, `label`, `parts`, `size`) | The hero figure: the number (`hero` from `md`, `display` on a phone), the unit on a stamp flag, a bar filled by `scaleX`, a split. `WORLD_COUNTRY_TOTAL` is 195 (193 UN members and 2 observer states) |
| `CountryChip` (`code`, `name`, `status`) | The ISO code on the stamp ink and the name; a planned country dashed in passport blue |
| `MapPin` (`x`, `y` in percent, `label`, `status`, `tag`, `isTagShown`, `isSelected`, `onClick`) | A place: a 14 px dot (10 px on a phone) in a 40 px button, its flag on hover and focus |
| `MapPinCluster` (`x`, `y`, `count`, `label`) | Dense pins merged on a phone: a 22 px stamp-ink dot with the count |
| `MapPopover` (`place`, `meta`, `coordinates`, children) | A pin's popover, 260 px on the raised surface; the app positions it |
| `MapLegend` (`items` of `visited` / `place` / `planned` / `land`) | The map's key, as HTML |
| `ChipRail` (`label`, `previousLabel`, `nextLabel`) | One row of chips (each in an `<li>`) that scrolls sideways without a scrollbar; a round arrow at each end shows while there is more in that direction and moves the row by most of its width |
| `MapLegendTooltip` (`label`, `items`, `note`) | The legend folded into one small button over a full-screen map: hover or focus shows the key (and the note, such as the map's source) as a tooltip above it; the button is described by the tooltip |
| `MapControls` (`label`, `zoomInLabel`, `zoomOutLabel`, `resetLabel`, `onZoomIn`, `onZoomOut`, `onReset`, `isAtMaxZoom`, `isAtMinZoom`, `isAtStart`, `orientation`) | The map's zoom controls: plus, minus and an optional reset as one flat bar on the raised surface (40 px buttons, hairlines between them, the `line-strong` outline round the group), vertical by default; the map owns the zoom and the limits disable the buttons |
| `Card`, `Photo` | A flat card (surface, one hairline, 24 px inside) and a 4:3 photo frame |
| `Postcard` (`title`, `meta`, `photo`, `stamp`, `headingLevel`), `PostcardStamp` (`year`, `code`, `status`) | A trip as a postcard, with the double-ringed postmark turned by -8° as its only ornament |
| `ATLAS_ICONS`, `ATLAS_ICON_STROKE_WIDTH` | The travel icons (`pin`, `globe`, `plane`, `compass`, `calendar`, `camera`, `pen`, `users`, `book`, `bag`, `arrow-right`, `menu`, `close`), lucide components in the system's 24 grid and 2 px stroke |
| `formatCoordinates(latitude, longitude)`, `getShare(value, total)` | `38.7223° N, 9.1393° W`; a share clamped to 0..1 |

### The world map (`@softure-ai/theme-flat-atlas/world-map`)

A separate entry, so a page without the map does not load its shapes (about 160 KB of path data).

| Export | What it is |
| --- | --- |
| `WorldMap` (`label`, `countries`, `places`, `selectedPlaceKey`, `onPlaceClick`, `hasGraticule`, `isFitted`, children) | The hero map: a static 1000 × 500 SVG with the countries painted by status, pins as HTML over it in the order given, children as an overlay (the open `MapPopover`). On a phone it keeps 720 px and scrolls sideways inside its own container. `isFitted` fills a box of a given height (a map that is the whole screen): the map stands in the middle, as large as the whole map fits, never below 720 px |
| `WORLD_COUNTRY_SHAPES`, `WORLD_GRATICULE_PATH`, `WORLD_MAP_VIEWBOX`, `WORLD_MAP_FIT` | The data: Natural Earth 1:110m countries (`world-atlas`, public domain) without Antarctica, keyed by ISO 3166-1 numeric code (`"616"` Poland, `"620"` Portugal), projected with Natural Earth II at build time |
| `projectToMapPercent(longitude, latitude)`, `projectNaturalEarth2`, `projectToFit` | The same projection at run time, for pins and a popover's position, without d3 in the bundle |

`countries` takes ISO numeric codes as world-atlas keys them; three Natural Earth units have none (Kosovo, Northern
Cyprus, Somaliland) and are always drawn as land. To start a phone's scroll on a region, set the container's
`scrollLeft` from `projectToMapPercent` once after the first render.

The shapes are generated: after a `world-atlas` or projection change run `npm run map:build -w
@softure-ai/theme-flat-atlas`; `tests/world-map-data.test.ts` fails when the file and the generator disagree.

## Tokens

`tests/fixtures/flat-atlas-tokens.json` is the design system's token snapshot (values only); `tests/tokens.test.ts`
keeps `src/tokens.ts` equal to it, and `tests/contrast.test.ts` checks the contrast the system promises in both
schemes. The text styles after `wordmark` in `src/tokens.ts` are the components' own steps from the design system's
component sheet (button sizes, meta lines, pin flags, the postmark).

## Release

The package publishes through the repository's `release.yml` like every other one (npm trusted publishing with
provenance). npm binds a trusted publisher only to a package that exists, so its first version goes out once with the
`NPM_TOKEN` secret and the owner then adds the publisher (GitHub Actions, `SOFTURE` / `AI`, workflow `release.yml`):
[scripts/release/README.md, "First release of a new package"](../../scripts/release/README.md#first-release-of-a-new-package).
