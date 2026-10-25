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
@import "@softure-ai/theme-notion/page.css";         /* body text 14 px, blue text selection, font smoothing */
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
@import "@softure-ai/theme-notion/page.css";
@import "@softure-ai/theme-kit/maplibre.css";        /* only if the app shows MapLibre maps */
```

`base.css` gives `body` the theme's background, text colour and sans font without the browser's 8 px margin, so a
page without a shell root, the dark scheme and the Radix portals mounted on `body` (select lists, menus, sheets) all
take the theme. It also gives every `border` without a colour class the theme's `border` grey and outlines a
half-transparent `ring` (shadcn/ui's `globals.css` rule), so table rows, accordion items, alerts and sheets do not
draw in the text colour. `maplibre.css` puts the theme's sans font on MapLibre maps (markers, popups, the attribution), which
`maplibre-gl.css` sets to Helvetica. `page.css` carries the rest of the design system's base layer: text outside the
components at the panel size (`text-sm`, 14 px, instead of the browser's 16 px), selected text on `blue-tag`, and
`-webkit-font-smoothing: antialiased` on `html`. All three read the theme with `--theme()` or its tokens, so they go through the app's Tailwind
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
wording by props: `Breadcrumb aria-label`, `BreadcrumbEllipsis label`, `PageHeader crumbsLabel`,
`DialogContent closeLabel`, `SheetContent closeLabel`, `SidePanel closeLabel`, `Steps stateLabels`,
`Sidebar mobileTitle mobileDescription`, `SidebarTrigger label`, `SidebarRail label`, `Spinner aria-label`,
`CommandDialog title description`.

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
- Figures, bar segments and box edges take a **tone** by what they mean: `default` (text colour), `success` (green,
  done), `warning` (orange, to do), `danger` (red, owed or failing), `muted` (gray, out of play). `TONE_COLORS` gives
  a tone's palette colour (`null` for `default`); `TONE_TEXT`, `TONE_FILL` and `TONE_EDGE` give literal class names
  (`text-*`, `bg-*`, `border-l-*`) that the shipped `theme.css` already generates, so the app adds no `@source`. The
  app keeps only its meaning-to-tone table:

  ```tsx
  import { TONE_TEXT, type Tone } from "@softure-ai/theme-notion";

  const PAYMENT_TONE: Record<"paid" | "due" | "overdue", Tone> = { paid: "success", due: "warning", overdue: "danger" };
  <span className={TONE_TEXT[PAYMENT_TONE.overdue]}>1 200</span>
  ```

## Components

All 36 shadcn/ui components of the design system, exported from the package root: accordion, alert, alert-dialog,
avatar, badge, breadcrumb, button, button-group, card, checkbox, collapsible, command, dialog, dropdown-menu, empty,
field, input, input-group, item, kbd, label, popover, progress, scroll-area, select, separator, sheet, sidebar,
skeleton, sonner (`Toaster`), spinner, switch, table, tabs, textarea, tooltip. Compositions: `Status` (badge, icon,
word), `PageHeader` (breadcrumb, icon box, title, description, actions), `PropertyList` (fields of one record),
`DetailTable` (an item's details as a label and value table), `FoldRow` (a list row folding open to a `DetailTable`
and more, a native `<details>`), `PageFrame` (a page outside the app shell, the target of `sft-bridge.css`),
`SidePanel` (a non-modal panel at a side of a canvas, below), `TabBar` (a screen's tabs as links with an optional icon
and count, the shown tab in the address; `Tabs` keeps it in client state), `MarkPopover` (a counted tag that opens a
list of what it counts, below), `FilterChip` and `FilterChipAdd` (a list's filter pills, below), `Steps` (numbered
stages with a state, below).

**`FilterChip`.** The filters above a list or a table, drawn the way a Notion database view draws them: a 24 px pill
`icon · Label: value ▾` that opens a menu of options in the design system's popover. While the default value is
chosen the pill is muted; `isActive` (a non-default value) turns it into the blue tag and sets `data-active`. The
children are `DropdownMenu` items, so the menu works from the keyboard. `FilterChipAdd` is the "+ Add filter" pill
next to them (`label` replaces the built-in "Add filter"), opening a menu of the fields to filter by.

```tsx
<div className="flex flex-wrap gap-1">
  <FilterChip label="Status:" value={status ?? "all"} icon={<CircleDot aria-hidden="true" />} isActive={status !== null}>
    <DropdownMenuRadioGroup value={status ?? "all"} onValueChange={setStatus}>
      <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="failed">Failed</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </FilterChip>
  <FilterChipAdd>
    <DropdownMenuItem onSelect={() => addFilter("owner")}>Owner</DropdownMenuItem>
  </FilterChipAdd>
</div>
```

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

A screen's summary figures: `StatsFold` (figures folded under a heading, closed by default, on native `<details>`),
`StatCards` (a wrapping row of figure cards: label, figure in its tone, optional `hint`, optional `aside` tag;
`isFullWidth` and `isOneRow` change the grid) and `StatPills` ("label **value**" tags in one row). Each figure takes a
`tone`; the app keeps only its own table of which meaning takes which tone.

```tsx
<StatsFold title="Summary">
  <StatCards
    label="Totals"
    cards={[
      { key: "paid", label: "Paid", value: "1,200", tone: "success" },
      { key: "owed", label: "Owed", value: "300", tone: "danger", hint: "2 invoices", aside: { text: "+5%" } },
    ]}
  />
  <StatPills label="Counts" pills={[{ key: "late", label: "Late", value: "1", tone: "danger" }]} />
</StatsFold>
```

An ordered process: `Steps` (the stages of a multi-step task, the phases of a migration, the steps of one run). An
`<ol>` where each step has a number in a badge coloured by its `state` (`done` green, `current` primary, `failed` red,
`todo` muted, the default), a `title`, an optional `note` and an optional `aside` at its end (a tag naming the service
the step uses). Layouts: `row` (default, a wrapping grid of cards, the current one on `blue-bg`) and `list` (compact
rows with a square badge). The current step carries `aria-current="step"`; each state is also a word for a screen
reader (`stateLabels` replaces the English words). `data-slot="steps"`, `data-step` and `data-state` mark the parts.

```tsx
<Steps
  label="Invoice stages"
  steps={[
    { key: "period", title: "Period", state: "done" },
    { key: "document", title: "Document", state: "current", note: "2 files attached" },
    { key: "invoice", title: "Final invoice", aside: <Badge variant="tag" color="blue">KSeF</Badge> },
  ]}
/>
```

**`MarkPopover`.** A tag in a palette colour with an icon and a count; a click or Enter opens the design system's
popover listing the entries, Escape or a click outside closes it. It runs on the browser's Popover API (no client
state, no portal): the panel sits in the top layer, so a card's `overflow` never clips it, centred on a phone and
under its mark where CSS anchor positioning is supported. Only phrasing elements, so it fits inside a `<summary>` or
a paragraph; a click on the panel's text does not toggle an enclosing `<details>`, links and buttons inside still
work. The colour means the worst of what it lists; the copy is props.

```tsx
<MarkPopover color="red" icon={TriangleAlert} count={2} label="2 open warnings, show the list"
  heading="Open warnings" closeLabel="Close" buttonData={{ "data-kind": "warnings" }}>
  <span role="listitem">Payment overdue</span>
  <span role="listitem"><a href="/tickets">Tickets to buy</a></span>
</MarkPopover>
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
