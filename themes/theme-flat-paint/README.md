# @softure-ai/theme-flat-paint

The Flat Paint design system as a package: near-black or white, cards with one hairline, one heavy grotesque (Ubuntu)
and one accent, lime, laid on flat without light, shadow or gradient. Built on
[`@softure-ai/theme-kit`](../theme-kit/README.md) like [`@softure-ai/theme-notion`](../theme-notion/README.md), for an
app whose components are [`@softure-ai/ui`](../../foundation/ui/README.md)'s: the theme ships the tokens, the bridge
that points ui's `--sft-*` tokens at them, the page base and the class maps where the look differs from ui's
defaults. It ships no components of its own.

## Install and wire up (Next.js App Router)

```bash
npm i @softure-ai/theme-flat-paint @softure-ai/ui tailwindcss @tailwindcss/postcss
```

```css
/* app/globals.css */
@import "@softure-ai/ui/styles.css";                 /* first: it declares the layer order */
@import "tailwindcss";
@import "@softure-ai/theme-flat-paint/theme.css";     /* tokens, utilities, dark:, the look maps as sources */
@import "@softure-ai/theme-flat-paint/sft-bridge.css"; /* ui's --sft-* tokens on the theme's roles */
@import "@softure-ai/theme-kit/base.css";             /* body on the theme's background, text colour and font */
@import "@softure-ai/theme-flat-paint/page.css";      /* scheme, number classes, motion, reduced motion */
```

**Fonts.** The theme names `Ubuntu` and `Ubuntu Mono` (the `latin-ext` subset carries Polish letters). An app that
loads them with `next/font` points the stacks at its variables after the imports:

```css
@theme inline {
  --font-sans: var(--font-ubuntu), system-ui, sans-serif;
  --font-mono: var(--font-ubuntu-mono), ui-monospace, monospace;
}
```

**Schemes.** Light by default, dark by the system setting; `data-theme="light" | "dark"` (`@softure-ai/ui`'s
`ThemeScript` and `ThemeSwitch`) or the classes `light` / `dark` choose one for the page or for a band of it: a black
hero on a light page is `<section class="dark bg-ink">`, a white band on a dark one `<section class="light bg-paper">`.
Each scope recomputes the roles and the ui bridge, so a ui component inside a band takes the band's scheme.

```tsx
import { Button, Card, Stat } from "@softure-ai/ui";
import { BUTTON_VARIANT_LOOK, CARD_TITLE_LOOK, ROLE_TONE, STAT_VALUE_LOOK } from "@softure-ai/theme-flat-paint";

<Card title="Retirement date" variant="lead" accent={ROLE_TONE.accessible} classNames={{ title: CARD_TITLE_LOOK.card }}>
  <Stat label="Net worth" value="2,480,000" size="lg" classNames={{ value: STAT_VALUE_LOOK.lg }} />
</Card>
<Button variant="primary" className={BUTTON_VARIANT_LOOK.primary}>Save</Button>
```

## Rules, in short

- Components paint with **roles** only: `background`, `surface`, `surface-raised`, `border`, `line-strong`,
  `foreground`, `muted`, `accent`, `accent-fill`, `on-accent`, `accessible`, `locked`, `debt`. The palette (`ink`,
  `lime`, `lime-deep`, `paper`, `graphite`, …) feeds the roles and the white and black bands. Tailwind's default
  palette is cleared.
- Two equal schemes, one geometry: check every screen in both, at 390 and 1440 px.
- **Lime is paint** (`accent-fill`): the primary button, a chart flag, a switch or checkbox that is on, an active
  tab's underline, a selected row's bar, always with black `on-accent`. On white it has 1.27:1, so in the light scheme
  it is never text or a thin line; accent text is `accent` (`lime-deep` in light, `lime` in dark).
- **A second carrier**: every state lime carries has another one (bold, the black knob and an `accent` line, a raised
  surface, a `line-strong` outline).
- **Data colour = meaning**: `accessible` (sea green), `locked` (amber), `debt` (crimson: debt, missing money, error,
  deletion). Lime never paints a data series. `ROLE_TONE` maps the three roles to ui's `success`, `warning`, `danger`.
- `position-*` colours are a palette for user-chosen series and markers only, never a button, a card or text.
- **Flat, no exceptions**: depth is the step `background` → `surface` → `surface-raised` and one 1 px `border`. No
  shadow, glow, gradient or `backdrop-filter`; the overlay is ink at 60 % without blur. The only "shadows" are lines:
  `shadow-selected-row` (a 3 px bar) and `shadow-shot-frame` (a 1 px frame).
- At most one `lead` card and one `primary` button per screen.
- Type: one face, Ubuntu (400 text, 500 labels and buttons, 700 headings and figures), Ubuntu Mono only in columns of
  digits. Headings `text-hero` 88, `text-display` 60, `text-headline` 40, `text-page` and `text-section` 30,
  `text-band` 26, `text-subsection` 18; text `text-body` 16, `text-body-sm` and `text-label` 14, `text-caption` 12,
  `text-eyebrow` 11 (uppercase, only a data label above a value). Each style carries its line height and tracking:
  write no `leading-*` or `tracking-*` next to it. Numbers: `figure` (one hero figure per block), `num` (in a row or
  a sentence), `tabular` (mono, only digits compared down a column).
- Space: `p-card` 24, `p-card-panel` 20, `mt-section` 96, `w-hairbar` 3, `px-control-x` 12, `px-button-x` 16;
  controls `h-control-sm` 32, `h-control-md` 40, `h-control-lg` 48, targets `size-touch` 44; widths `max-w-measure`
  42 rem, `max-w-panel` 80 rem, `max-w-apex` 96 rem.
- Radii: `rounded-card` 12 (card, dialog), `rounded-nested` 8 (always smaller than its parent), `rounded-control` 8
  (button, field, segment gutter), `rounded-segment` 6, `rounded-checkbox` 5, `rounded-flag` 4, `rounded-pill`.
- Motion: `--duration-fast` 160 ms (hover, press, focus; every bare `transition`), `--duration-base` 200 ms
  (reveal), `--duration-slow` 240 ms (a panel, a step); easings `ease-out-soft` (default), `ease-out-snap`
  (reveals), `ease-out-settle` (a result settling, never a hover). Nothing overshoots, nothing animates `width` or
  `height`, a press is `scale(0.97)`, and the still state is the final state.
- Focus: a 2 px `accent` ring 2 px off the element on a `background` gap; a field takes an `accent` line and a 1 px
  ring. `accent` holds 3:1 on every surface of both schemes. An error stands at its field: a `debt` line and the
  message under it.

## Look maps

Class strings for `className` / `classNames` of the ui components, holding only what differs from ui's defaults (an
app class beats ui's `@layer softure`). They are literals, so `theme.css` lists their folder as a Tailwind source and
the app adds no `@source`.

| Export | For |
| --- | --- |
| `BUTTON_VARIANT_LOOK` | `Button`, `ButtonLink`, `ButtonAnchor` `className` by variant (`ink`, `ink-outline` on a white band) |
| `getIconButtonLook(size, tone)`, `ICON_BUTTON_SIZE_LOOK`, `ICON_BUTTON_TONE_LOOK` | `IconButton` root |
| `CARD_ROOT_LOOK`, `CARD_TITLE_LOOK`, `CARD_STEP_LOOK` | `Card` slots `root`, `title` (`card` or `section`), `step` |
| `STAT_VALUE_LOOK`, `STAT_SECONDARY_LOOK` | `Stat` slots `value` (by size) and `secondary` |
| `FIELD_LABEL_LOOK` | `Field` slot `label`, and a label built next to a field |
| `SWITCH_INPUT_LOOK`, `SWITCH_TRACK_LOOK`, `SWITCH_KNOB_LOOK` | a switch drawn over a native checkbox |
| `CHECKBOX_LOOK` | `Checkbox` slots with `unstyled` |
| `getModalLook(width)`, `MODAL_LOOK`, `STANDING_PANEL_LOOK` | `Modal` and `StandingPanel` `classNames`: flat veil, entrance motion, no shadow, title on `text-page` |
| `SEGMENTED_GROUP_LOOK`, `SEGMENT_ACTIVE_LOOK`, `SEGMENT_IDLE_LOOK`, `SEGMENT_ACTIVE_WHEN_CURRENT_LOOK` | a segmented control, and ui's `SegmentedNav` |

## Tokens

`FLAT_PAINT_THEME` (`src/tokens.ts`, also exported as `theme`) is the source, declared with the kit's `defineTheme`;
`tests/tokens.test.ts` keeps it equal to the design system's token snapshot (`tests/fixtures/flat-paint-tokens.json`,
the values of the design system's `tokens.json`). When the design system changes, refresh the snapshot and the
definition in one change. The shadcn colour roles are aliases on top; two of them keep the design system's meaning,
which differs from shadcn's: `muted` is the secondary **text** colour (shadcn's muted text is `muted-foreground`, an
alias of it here) and `accent` is the accent **text** and focus colour. A raised background is `secondary`.

**Contrast.** `tests/contrast.test.ts` measures WCAG 2.2 AA in both schemes: `foreground`, `muted`, `accent` and
the three data roles reach 4.5:1 on `background`, `surface` and `surface-raised`, `on-accent` on `accent-fill`, and
`accent` and `line-strong` 3:1 as focus ring and control boundary.

**Overriding a token.** Redefine its CSS variable after `theme.css`, for both schemes, or build a variant with
`extendTheme(theme, { name, colors: { … } })` and `buildThemeCss` (the kit README, "Overriding in an app").
