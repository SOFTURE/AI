# @softure-ai/theme-notion

The Notion design system as a package: shadcn/ui (style new-york v4, Radix primitives, Tailwind CSS v4,
`lucide-react` icons) with Notion's tokens and the system's component deltas. The look: lots of white, warm graphite
instead of black, grey highlights instead of borders, colour only where it carries meaning. Built on
[`@softure-ai/theme-kit`](../theme-kit/README.md).

## Install and wire up (Next.js App Router)

```bash
npm i @softure-ai/theme-notion tailwindcss @tailwindcss/postcss
```

```css
/* app/globals.css */
@import "tailwindcss";
@import "@softure-ai/theme-notion/theme.css";       /* tokens, utilities, dark:, animations, the components' classes */
@import "@softure-ai/theme-notion/sft-bridge.css";  /* optional: pages of the SOFTURE packages in a PageFrame */
@import "@softure-ai/theme-kit/base.css";            /* body on the theme's background, text colour and font */
@import "@softure-ai/theme-kit/maplibre.css";        /* only if the app shows MapLibre maps */
```

`theme.css` names the package's components as Tailwind sources, so their classes are generated without the app
listing `node_modules`. It clears Tailwind's default palette: only the theme's colours exist as utilities.

An app that also renders pages of the SOFTURE packages (on `@softure-ai/ui`'s `--sft-*` tokens) keeps their base by
taking the scoped preflight instead of Tailwind's:

```css
@import "@softure-ai/ui/styles.css";                 /* first: it declares the layer order */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "@softure-ai/theme-kit/preflight.css";      /* Tailwind's preflight, only inside [data-slot] elements */
@import "tailwindcss/utilities.css" layer(utilities);
@import "@softure-ai/theme-notion/theme.css";
@import "@softure-ai/theme-notion/sft-bridge.css";
@import "@softure-ai/theme-kit/base.css";            /* nothing else styles body under the scoped preflight */
@import "@softure-ai/theme-kit/maplibre.css";        /* only if the app shows MapLibre maps */
```

`base.css` gives `body` the theme's background, text colour and sans font without the browser's 8 px margin, so a
page without a shell root, the dark scheme and the Radix portals mounted on `body` (select lists, menus, sheets) all
take the theme. `maplibre.css` puts the theme's sans font on MapLibre maps (markers, popups, the attribution), which
`maplibre-gl.css` sets to Helvetica. Both read the theme with `--theme()`, so they go through the app's Tailwind
after `theme.css`; the app's `globals.css` keeps only `@import` lines.

```tsx
import { Button, Badge, Status, PageHeader, TooltipProvider, Toaster } from "@softure-ai/theme-notion";
import { CircleCheck } from "lucide-react";

<TooltipProvider>
  <PageHeader title="Projects" crumbs={[{ label: "Workspace", href: "/" }, { label: "Projects" }]} />
  <Badge variant="tag" color="blue">Marketing</Badge>
  <Status color="green" icon={CircleCheck}>Done</Status>
  <Button>Save</Button>
</TooltipProvider>
<Toaster />
```

**Dark scheme.** Light by default, dark by the system setting; `class="dark"` (`next-themes` with
`attribute="class"`) or `data-theme="dark"` (`@softure-ai/ui`'s `ThemeScript` and `ThemeSwitch`) choose it, and
`light` the other way. `Toaster` follows the system unless it gets `theme="light" | "dark"`.

**Copy.** The components' built-in texts are accessible names in English (`notionMessages.en`). Pass the app's own
wording by props: `Breadcrumb aria-label`, `BreadcrumbEllipsis label`, `DialogContent closeLabel`,
`SheetContent closeLabel`, `SidePanel closeLabel`, `Sidebar mobileTitle mobileDescription`, `SidebarTrigger label`, `SidebarRail label`,
`Spinner aria-label`, `CommandDialog title description`.

## Rules, in short

- Background `background`, text `foreground`, secondary text `muted-foreground`. Never pure black.
- Hover is the grey `accent` background, never a border or a shadow; selected and pressed use `accent-strong`.
- One `primary` (blue, `#2383e2`) action per screen. Other buttons are `secondary`, `outline` or `ghost`.
- A palette colour (`gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `red`, each with `-bg`,
  `-tag`, `-tag-foreground`) marks an area (a tag) or a state (a status, a callout), never decoration. The same
  colour always means the same thing; the app keeps its own table of meanings.
- Borders are quiet. Form fields have the grey `field` background and a thin `input` border; focus is the blue
  `ring`. Things that float use shadows, not borders: `shadow-menu`, `shadow-dialog`, `shadow-card`.
- Type: system sans, mono for identifiers. `text-page-title` 40/48 bold once per screen, `text-heading-1..3`
  30/24/20, `text-body` 16/24, `text-ui` 14/20 (panels), `text-small` 12/16, `text-section-label` 12/16 medium.
- Spacing on a 4 px grid (`p-1` = 4 px). Sizes: `sidebar-width` 240, `content-width` 708, `content-width-wide` 1152,
  `control-height` 28, `row-height` 34. Radius: `rounded-xs` 3 (tag, checkbox), `sm` 4 (tooltip, kbd), `md` 6
  (button, field, menu item), `lg` 8 (callout, card), `xl` 10 (menu, select, dialog), `full` (switch).
- Icons: lucide at `ICON_STROKE_WIDTH` (1.75), 16 px in text; they inherit the text colour. No emoji in the interface.
- Statuses always carry a word and an icon, so states read apart without telling green from red.

## Components

All 36 shadcn/ui components of the design system, exported from the package root: accordion, alert, alert-dialog,
avatar, badge, breadcrumb, button, button-group, card, checkbox, collapsible, command, dialog, dropdown-menu, empty,
field, input, input-group, item, kbd, label, popover, progress, scroll-area, select, separator, sheet, sidebar,
skeleton, sonner (`Toaster`), spinner, switch, table, tabs, textarea, tooltip. Compositions: `Status` (badge, icon,
word), `PageHeader` (breadcrumb, icon box, title, description, actions), `PropertyList` (fields of one record),
`PageFrame` (a page outside the app shell, the target of `sft-bridge.css`), `SidePanel` (a non-modal panel at a side
of a canvas, below).

**`SidePanel`.** A panel next to a canvas (a map) that leaves the canvas usable, so a switch inside shows its effect
at once (`Sheet` is modal). It floats on `background` with `shadow-menu`, 24 rem wide, full width on a phone, with a
heading and a ghost close button. Layouts: `over` (over the canvas's right side), `left` (over its left side),
`beside` (after the canvas, which shrinks to at least 24 rem or half) and `list` (a 24 rem column before the canvas);
`beside` and `list` cover the whole canvas on a phone. While closed it is `hidden`. Focus moves into it when it opens;
Escape inside or the close button calls `onClose`, and the caller moves focus back to its opener.

```tsx
<div className="relative flex h-full">
  <button type="button" aria-controls="layers" aria-expanded={isOpen} onClick={() => setOpen(true)}>Layers</button>
  <Map className="flex-1" />
  <SidePanel id="layers" heading="Layers" layout="over" isOpen={isOpen} onClose={() => setOpen(false)}>
    {/* switches */}
  </SidePanel>
</div>
```

Deltas from stock shadcn:

- `button`: sizes 28/24/32 px, a smaller padding on the icon side, a Notion `ghost`, `secondary` hover
  `accent-strong`, no shadows.
- `badge`: a `tag` variant and a `color` prop with the nine palette colours. `alert`: palette colour variants (a
  Notion callout).
- `input`, `textarea`, `select`, `input-group`: 28 px high, grey `field` background, thin `input` border.
- `dropdown-menu`, `select`, `popover`, `command`: radius 10, `shadow-menu` without a border, 28 px items.
- `dialog`, `alert-dialog`: radius 10, `shadow-dialog`, no border. `card`: `shadow-card` instead of a border.
- `checkbox` 16 px with a 1.5 px border, `switch` 26 × 16 (thumb shadow in `SWITCH_THUMB_SHADOW_CLASS`, for a native
  switch drawn the same), `tooltip` dark without an arrow, `tabs` default to the `line` variant, `progress` 6 px.
- `table`: a 34 px header in `muted-foreground`, a line under the last row too.
- `sidebar`: a controlled sidebar keeps no cookie; the phone sheet's title and description are props; the menu
  skeleton's width is stable per item (shadcn draws a random one during render).
- `sonner`: no `next-themes`; `theme` is a prop. Focus everywhere: `ring-2 ring-ring` instead of `ring-[3px]`.

A component the app needs beyond these: add it in this package (`npx shadcn@latest add <name>` in a scratch app,
then the deltas above), not in the app.

## Tokens

`NOTION_THEME` (`src/tokens.ts`, also exported as `theme`, the name every theme package uses) is the source, declared
with the kit's `defineTheme`; `tests/tokens.test.ts` keeps it equal to the design system's token snapshot
(`tests/fixtures/notion-tokens.json`). When the design system changes, refresh the snapshot and the definition in one
change. `cn` is `createThemeCn(NOTION_THEME)`. The build writes `theme.css` with the kit's `softure-theme-css` from
`softureTheme` in `package.json` (the kit README, "The theme package contract").

**Overriding a token.** Redefine its CSS variable after `theme.css` (`:root { --primary: #e16259; }`, and the same in
a `.dark` block for the dark value), or build a variant with `extendTheme(theme, { name, colors: { … } })` and write
it with `buildThemeCss` (the kit README, "Overriding in an app").
