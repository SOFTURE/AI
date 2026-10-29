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
@import "@softure-ai/theme-notion/base.css";         /* body on the theme's background, text colour and font */
@import "@softure-ai/theme-notion/page.css";         /* body text 14 px, blue text selection, font smoothing */
@import "@softure-ai/theme-notion/maplibre.css";     /* only if the app shows MapLibre maps */
```

Every stylesheet comes from the theme. `base.css`, `maplibre.css` and `preflight.css` are the kit's
([`@softure-ai/theme-kit`](../theme-kit/README.md)), re-exported by the theme: they resolve the kit from the theme's own
dependency, so the app declares only the theme and gets the kit version the theme was built against, in any package
manager layout.

`theme.css` names the package's components as Tailwind sources, so their classes are generated without the app
listing `node_modules`. It clears Tailwind's default palette: only the theme's colours exist as utilities.

An app that also renders pages of the SOFTURE packages (on `@softure-ai/ui`'s `--sft-*` tokens) keeps their base by
taking the scoped preflight instead of Tailwind's:

```css
@import "@softure-ai/ui/styles.css";                 /* first: it declares the layer order */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "@softure-ai/theme-notion/preflight.css";   /* Tailwind's preflight, only inside [data-slot] elements */
@import "tailwindcss/utilities.css" layer(utilities);
@import "@softure-ai/theme-notion/theme.css";
@import "@softure-ai/theme-notion/sft-bridge.css";
@import "@softure-ai/theme-notion/base.css";         /* nothing else styles body under the scoped preflight */
@import "@softure-ai/theme-notion/page.css";
@import "@softure-ai/theme-notion/maplibre.css";     /* only if the app shows MapLibre maps */
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
`CommandDialog title description` (`title` also names its search field), `Command label` (the search field's
name outside a `CommandDialog`; without it the field has none), `SortableList instructions announcements`, `SortableHandle label`.

## Rules, in short

- Background `background`, text `foreground`, secondary text `muted-foreground`. Never pure black.
- Hover is the grey `accent` background, never a border or a shadow; selected and pressed use `accent-strong`.
- One `primary` (blue, `#0171cf`) action per screen. Other buttons are `secondary`, `outline` or `ghost`; a button
  over a map or an image is `floating`.
- A palette colour (`gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `red`, each with `-bg`,
  `-tag`, `-tag-foreground`) marks an area (a tag) or a state (a status, a callout), never decoration. The same
  colour always means the same thing; the app keeps its own table of meanings.
- Borders are quiet. Form fields have the grey `field` background and a thin `input` border; focus is the blue
  `ring`. Things that float use shadows, not borders: `shadow-menu`, `shadow-dialog`, `shadow-card`.
- Type: system sans, mono for identifiers. `text-page-title` 40/48 bold once per screen, `text-heading-1..3`
  30/24/20, `text-body` 16/24, `text-ui` 14/20 (panels), `text-small` 12/16, `text-section-label` 12/16 medium.
- Spacing on a 4 px grid (`p-1` = 4 px). Sizes: `sidebar-width` 240, `content-width` 708, `content-width-wide` 1152,
  `control-height` 28, `row-height` 34, `touch-target` 44 (rows and controls meant to be tapped on a phone, e.g.
  `min-h-touch-target md:min-h-row-height`). Radius: `rounded-xs` 3 (tag, checkbox), `sm` 4 (tooltip, kbd), `md` 6
  (button, field, menu item), `lg` 8 (callout, card), `xl` 10 (menu, select, dialog), `full` (switch).
- Icons: lucide at `ICON_STROKE_WIDTH` (1.75), 16 px in text; they inherit the text colour. No emoji in the interface.
- Statuses always carry a word and an icon, so states read apart without telling green from red.
- A badge never leaves its container (`max-w-full`). In a narrow one (a grid card, a table cell) a `Status` word that
  does not fit ends in an ellipsis while the icon keeps its size, and the full word is the badge's `title` when it is
  a string or a number (pass `title` for any other node). A plain `Badge` clips its text at the end; wrap the
  text in `<span className="min-w-0 truncate">` for an ellipsis.
- Installed on a phone's home screen (`viewport-fit=cover`), the parts at a screen edge pad by the screen's
  safe-area insets on the edges they touch: `SheetContent` (every `side`, its close button too), the `Sidebar` on a
  phone, the popper `SelectContent` (its height stops short of the inset it opens towards) and `PageFrame`. The insets
  are 0 on a desktop and in a browser with its own bars. Padding passed to `SheetContent` replaces the inset on that
  edge, so put content padding on its children (`SheetHeader`, `SheetFooter`, an inner `div`). An app pads its own
  screen roots with the same classes: `pt-[env(safe-area-inset-top)]`, `pb-[env(safe-area-inset-bottom)]`,
  `pl-[env(safe-area-inset-left)]`, `pr-[env(safe-area-inset-right)]`.
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

All 37 shadcn/ui components of the design system, exported from the package root: accordion, alert, alert-dialog,
avatar, badge, breadcrumb, button, button-group, card, checkbox, collapsible, command, dialog, dropdown-menu, empty,
field, input, input-group, item, kbd, label, popover, progress, radio-group, scroll-area, select, separator, sheet,
sidebar, skeleton, sonner (`Toaster`), spinner, switch, table, tabs, textarea, tooltip. Compositions: `Status` (badge, icon,
word), `PageHeader` (breadcrumb, icon box, title, description, actions), `PropertyList` (fields of one record),
`DetailTable` (an item's details as a label and value table), `FoldRow` (a list row folding open to a `DetailTable`
and more, a native `<details>`), `PageFrame` (a page outside the app shell, the target of `sft-bridge.css`),
`SidePanel` (a non-modal panel at a side of a canvas, below), `SheetMenu`, `SheetMenuItem` and `SheetMenuButton`
(navigation rows in a side `Sheet`, a phone's drawer, below), `TabBar` (a screen's tabs as links with an optional icon
and count, the shown tab in the address; `Tabs` keeps it in client state), `MarkPopover` (a counted tag that opens a
list of what it counts, below), `FilterChip` and `FilterChipAdd` (a list's filter pills, below), `Steps` (numbered
stages with a state, below), `Timeline` (dated entries on a vertical rail, below), `Code` (inline code) and `CodeBlock` (a mono block for logs and paths, below),
`SortableList`, `SortableItem`, `SortableHandle` and `SortableActivator` (rows reordered by dragging, below),
`MiniProgress` (a compact bar with its figure inside, for a table cell or a tile, below),
`UpdatePrompt` (the offer to reload into a new build, for an installed app, below).

**Touch sizes.** The controls a phone view taps most reach the `touch-target` token (44 px, Apple's HIG and WCAG
2.5.5): `Button` sizes `touch` (44 px high, padded like `lg`) and `icon-touch` (44 × 44), `SelectTrigger`
`size="touch"`, and `SelectItem` at least 44 px high, for a whole list (`SelectContent size="touch"`) or one item
(`SelectItem size="touch"`; an item's own `size` wins over its list's). Each sets its height with a plain class, so
one breakpoint class brings the pointer size back on a desktop.

```tsx
<Button size="touch" className="md:h-7 md:px-2.5">Save</Button>
<Button size="icon-touch" aria-label="Add" className="md:size-7"><Plus /></Button>
<Select>
  <SelectTrigger size="touch" className="md:h-7" aria-label="View"><SelectValue /></SelectTrigger>
  <SelectContent size="touch" position="popper">
    <SelectItem value="table" className="md:min-h-7">Table</SelectItem>
  </SelectContent>
</Select>
```

**`FoldRow`.** An item as one list row in a native `<details>`: a chevron, the title, short facts and badges on the
right; opened, it shows a `DetailTable` and its `children`. The opened content is padded 12 px on all four sides
(`p-3`), so a table sits centred under the row; `isInset` indents it under the title instead (24 px on the left) and
sets `data-inset` on the content, like `StatsFold`. A row with a summary of its own (icons, a status) passes `summary`,
drawn after the chevron in place of `title`, `facts` and `badges`; `details` and `detailsLabel` are optional together,
so the content can be several tables or a list.

```tsx
<FoldRow title="Dentist" facts={["12.01.2027"]} badges={[]} detailsLabel="Visit details" details={rows} />
<FoldRow summary={<><Receipt aria-hidden="true" className="size-4" /> Invoice 12/2026 <Badge>Paid</Badge></>}>
  <InvoiceLines />
</FoldRow>
```

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

**`SheetMenu`.** A phone's navigation drawer: a `Sheet` from the right with a heading and a ghost close button,
navigation rows at the top and one row at the foot, the way a desktop `Sidebar` ends with its foot menu.
`SheetMenu` (`ul`), `SheetMenuItem` (`li`) and `SheetMenuButton` (the row) mirror `SidebarMenu`, `SidebarMenuItem`
and `SidebarMenuButton`, but need no `SidebarProvider`. A row is full width, its icon and label left-aligned in the
`foreground` colour (`text-ui`, icons 16 px), 44 px tall on a phone (`min-h-touch-target`) and a 34 px list row from
`md` (`min-h-row-height`); hover, press and the active row (`isActive`, `data-active`) take `accent`, focus the
`ring`; `disabled` (or `aria-disabled` on a link) dims it to 50 % and drops its clicks. `asChild` renders a link with
the row's look (add `aria-current="page"` on the active one); wrap a row in `SheetClose asChild` to close the drawer
on a click. The heading and the foot are a recipe from the existing parts: `showCloseButton={false}` on
`SheetContent`, the close as a ghost icon `Button` in a `SheetHeader` row, and the foot rows in a `SheetFooter`
(already pushed to the panel's foot by `mt-auto`) with `border-t`.

```tsx
<Sheet open={isOpen} onOpenChange={setOpen}>
  <SheetContent side="right" showCloseButton={false} className="gap-0">
    <SheetHeader className="flex-row items-center justify-between gap-2 border-b py-2 pr-2 pl-4">
      <SheetTitle>Workspace</SheetTitle>
      <SheetClose asChild>
        <Button variant="ghost" size="icon" aria-label={t("menu.close")}>
          <X aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
        </Button>
      </SheetClose>
    </SheetHeader>
    <nav aria-label={t("menu.label")} className="p-2">
      <SheetMenu>
        <SheetMenuItem>
          <SheetClose asChild>
            <SheetMenuButton asChild isActive>
              <Link href="/" aria-current="page">
                <House aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
                <span>{t("menu.home")}</span>
              </Link>
            </SheetMenuButton>
          </SheetClose>
        </SheetMenuItem>
      </SheetMenu>
    </nav>
    <SheetFooter className="border-t p-2">
      <SheetMenu>
        <SheetMenuItem>
          <SheetMenuButton onClick={signOut}>
            <LogOut aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
            <span>{t("menu.signOut")}</span>
          </SheetMenuButton>
        </SheetMenuItem>
      </SheetMenu>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

An app that laid out ghost `Button`s itself (`size="lg" className="min-h-touch-target w-full justify-start text-ui
text-foreground"`) moves each row to `SheetMenuButton` and drops those classes.

A screen's summary figures: `StatsFold` (figures folded under a heading, closed by default, on native `<details>`),
`StatCards` (a wrapping row of figure cards: label, figure in its tone, optional `progress` bar under the figure,
optional `hint`, optional `aside` tag; `isFullWidth` and `isOneRow` change the grid) and `StatPills` ("label **value**" tags in one row). Each figure takes a
`tone`; the app keeps only its own table of which meaning takes which tone. A card's `progress` (0–100, clamped) draws
the package's 6 px `Progress` under the figure, filled in the card's tone (primary without one) and named by
`progressLabel` (default: the card's `label`). A card's `icon` (a Lucide icon component) is drawn before the label: 16 px,
`ICON_STROKE_WIDTH`, the label's muted colour, 6 px apart, `aria-hidden` (the label stays the card's text).
`StatsFold`'s content spans the heading row's full width (the same left and right edges as the row); `isInset` indents
it to line up with the title after the chevron.

```tsx
<StatsFold title="Summary">
  <StatCards
    label="Totals"
    cards={[
      { key: "paid", label: "Paid", value: "1,200", tone: "success", icon: Wallet },
      { key: "owed", label: "Owed", value: "300", tone: "danger", hint: "2 invoices", aside: { text: "+5%" } },
      { key: "hours", label: "Hours", value: "21.5 / 23.4 h", progress: 92, progressLabel: "Hours used" },
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

A dated sequence: `Timeline` (a trip's stays and the moves between them, an order's history, a project's milestones).
An `<ol>` named by `label` where each entry sits on one continuous vertical rail, running from the first marker to the
last: a marker in a palette `color` (`gray` by default) with an optional Lucide `icon`, then the body: an optional `time`
(muted, tabular figures), the `title`, an optional muted `description`, an optional `badges` row (statuses, tags) and
optional `children` under it (deadlines, notes). `size` `default` is a major entry (a 24 px round marker in the colour's
tag fill, the time above the title); `compact` is a minor entry between two major ones (the icon or a dot in the
colour on the page, the time after the title, the description and badges on one wrapping line). `line: "dashed"` dashes the rail through an entry for something
missing. With `onSelect` the body is a button; `actionLabel` is read before its visible text ("Show on the map"), so
the button's name says what it does and still contains every word it shows; `aside` sits at the right edge outside that
button, so a mark with its own popover never nests in it. The colour never carries a meaning alone: put the state in
words in `badges`. `data` sets an app's own `data-*` attributes on the item. `data-slot="timeline"`,
`timeline-item` (with `data-item`, `data-size`, `data-line`), `timeline-rail`, `timeline-marker`, `timeline-item-body`
and the body's parts mark the parts.

```tsx
<Timeline
  label="Trip"
  items={[
    { key: "flight", size: "compact", icon: Plane, color: "green", title: "Flight", time: "7 Dec, 07:15", description: "Home → Hanoi" },
    {
      key: "hanoi", icon: BedDouble, color: "green", time: "8–9 Dec · 2 nights", title: "Hanoi",
      badges: <Status color="green" icon={CircleCheck}>Booked</Status>,
      onSelect: () => showOnMap("hanoi"), actionLabel: "Show on the map",
    },
    { key: "sapa", icon: CircleDashed, color: "yellow", line: "dashed", time: "11–12 Dec", title: "Sa Pa",
      badges: <Status color="yellow" icon={CircleDashed}>No stay</Status> },
  ]}
/>
```

**`MiniProgress`.** A share with its figure inside the bar, for a table cell or a tile where a figure next to a
`Progress` would collide with it: a 20 px rounded track (`primary/12`) that takes the cell's width (at least 64 px),
filled in `primary` (the link blue in dark, as in `Progress`) or in its `tone`'s colour. `value` is 0–100, clamped
(non-finite reads as 0); `label` is the text inside (default: the rounded percent). The label is drawn twice: in
`foreground` on the track and in the page `background` clipped to the fill, so it reads at any value, also where the
fill's edge crosses a letter, and passes AA on the track and on every fill in both schemes. A label wider than the cell
ends in an ellipsis inside the bar. The bar is Radix's `progressbar`: a string label is its `aria-valuetext` (the amount
is announced, not only the percent), the drawn copies are `aria-hidden`; give it a name with `aria-label`. Slots:
`mini-progress` (with `data-tone`), `mini-progress-indicator`, `mini-progress-label`.

```tsx
<TableCell className="w-24">
  <MiniProgress value={task.costShare} label={formatUsd(task.costUsd)} aria-label={messages.costShare} />
</TableCell>
<MiniProgress value={82} tone="warning" aria-label={messages.budgetUsed} />
```

An app that set a figure in a fixed-width span next to `Progress` (`flex gap-2` + `w-16` + `Progress`) swaps the
pair for one `MiniProgress` and drops the widths.

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

**`Code` and `CodeBlock`.** `Code` is inline code: the `text-code` style (13/20 mono) in its own red,
`code-foreground` (a shade of the palette `red` that reaches 4.5:1 on its chip), on `secondary`, as in Notion. `CodeBlock` is a `<pre>` for logs and file paths on `muted`, radius 8; long lines scroll sideways, `wrap` wraps
them. With `label` the block is a named region (`role="region"`) that keyboard users can focus and scroll; without it,
plain text. No syntax highlighting. `data-slot="code"` and `data-slot="code-block"` mark the parts.

```tsx
<p>Run <Code>npm ci</Code> first.</p>
<CodeBlock label="Build log" wrap>{log}</CodeBlock>
```

**`UpdatePrompt`.** The offer to reload into a new build, for an installed app on `@softure-ai/pwa`: a floating
`Alert` at the bottom of the screen (`shadow-menu`, at most `max-w-md`), padded by the safe-area insets so it clears a
phone's home indicator and notch, with a reload `Button` at the touch height (`md:h-7` on a desktop). It is a polite
`status`, not an `alert`, so it never interrupts a screen reader. It draws nothing until `open`. The copy is props,
keyed like `pwaMessages.en.update`; `data-slot="update-prompt"` marks the root.

```tsx
const { isUpdateReady, activate } = useServiceWorkerUpdate(); // @softure-ai/pwa/react
<UpdatePrompt open={isUpdateReady} onReload={activate} {...messages.update} />
```

**`SortableList`.** A list whose rows are reordered by dragging, built on the headless `@dnd-kit/core` and
`@dnd-kit/sortable`. On a touch screen a long press (`holdDelay`, 500 ms) lifts a row; moving more than `tolerance`
(8 px) before that scrolls instead, and a tap still activates the row. A mouse drags the same way; from the keyboard
Space or Enter picks the focused row up, the arrows move it, Space or Enter drops it and Escape cancels. The row only
moves up and down. The lifted row floats on `accent-strong` with `shadow-menu` above its siblings and carries
`data-dragging`; every row has `touch-manipulation select-none` and no long-press callout. The order stays with the
app: `items` are the rows' ids in order, and `onReorder(next, { id, from, to })` gets the new order on a drop.
`dragBy="handle"` leaves the row alone and drags only by a `SortableHandle` (a ghost grip button, for a desktop list;
a mouse starts at once there). A screen reader hears the `instructions` on the row (or handle) and the
`announcements` while it moves: strings with `{item}`, `{position}` and `{total}`, where `getItemLabel(id)` names the
row (the id by default). `data-slot="sortable-list"`, `sortable-item` (with `data-id`), `sortable-handle` and
`sortable-activator` mark the parts.

`dragBy="activator"` lifts a row only from the app's own element wrapped in `SortableActivator` (the row's button,
not its unfolded details), with the same hold; the element keeps its click and keys. The keyboard still picks up the
focused row, so the row stays focusable next to the button: Space and Enter on the button keep meaning "open". A key
pressed on any control inside a row stays with that control in every mode. `disabled` on the list makes it read-only
(no row lifts by touch, mouse or keyboard, the drag attributes go, the rows keep their own handlers, `data-disabled`
marks them); `disabled` on a `SortableItem` holds one row and wins over the list's. `group` on a `SortableItem` keeps
a lifted row among rows of the same group (by pointer and keyboard); rows without a group form one together.
`onDragStart(id)`, `onDragEnd(id, move | null)` (every drop; `null` when the order stayed) and `onDragCancel(id)`
follow the drag, and the list carries `data-sorting` while a row is lifted (`group-data-[sorting]:hidden` on a row's
secondary content with `group` on the list). `as="ol"` renders a numbered list; children that are not a
`SortableItem` (an empty-state `<li>`) stay in place. The click that ends a mouse drop never reaches the row.

```tsx
<SortableList label="Shopping list" items={ids} onReorder={(next) => setIds(next)}
  getItemLabel={(id) => byId[id].name} announcements={{ pickedUp: t("sort.pickedUp") }}>
  {ids.map((id) => (
    <SortableItem key={id} id={id} className="flex h-row-height items-center gap-2 px-2">
      <Link href={`/items/${id}`}>{byId[id].name}</Link>
    </SortableItem>
  ))}
</SortableList>

<SortableList label="Columns" items={columns} onReorder={setColumns} dragBy="handle">
  {columns.map((id) => (
    <SortableItem key={id} id={id} className="flex items-center gap-1 px-1">
      <SortableHandle label="Move column" />
      {id}
    </SortableItem>
  ))}
</SortableList>

<SortableList label="Day" as="ol" items={ids} onReorder={setIds} dragBy="activator" disabled={isReadOnly}
  onDragStart={() => navigator.vibrate?.(10)} className="group">
  {ids.map((id) => (
    <SortableItem key={id} id={id} group={byId[id].isStop ? "stops" : "to-fit"}>
      <SortableActivator>
        <button type="button" onClick={() => toggle(id)}>{byId[id].name}</button>
      </SortableActivator>
      {openId === id ? (
        <div className="group-data-[sorting]:hidden">
          <DetailTable label="Details" rows={byId[id].details} />
        </div>
      ) : null}
    </SortableItem>
  ))}
  {ids.length === 0 ? <li className="text-muted-foreground">Nothing planned</li> : null}
</SortableList>
```

Deltas from stock shadcn:

- `button`: sizes 28/24/32 px, a smaller padding on the icon side, a Notion `ghost`, `secondary` hover
  `accent-strong`, no shadows. `outline` lays its hover tint over its opaque background. A `floating` variant is for a
  button over a map, an image or any non-page surface: opaque in every state, `shadow-menu`, no border, the `accent`
  tint on hover and `accent-strong` while `aria-expanded="true"`.
- `badge`: a `tag` variant and a `color` prop with the nine palette colours (and `default`); `color` applies to every
  variant but `destructive`, which keeps its own fill and white text. `alert`: palette colour variants (a
  Notion callout).
- `input`, `textarea`, `select`, `input-group`: 28 px high, grey `field` background, thin `input` border.
- `dropdown-menu`, `select`, `popover`, `command`: radius 10, `shadow-menu` without a border, 28 px items.
- `command`: `CommandDialog` passes its `title` to cmdk's `label`, the search field's accessible name (cmdk's
  `aria-labelledby` wins over an `aria-label` on `CommandInput`). `CommandInput` renders its `children` at the end of
  the input row and merges `wrapperClassName` into the row:

  ```tsx
  <CommandDialog open={open} onOpenChange={setOpen} title="Search pages">
    <CommandInput placeholder="Search…" wrapperClassName="h-12">
      <Kbd>Esc</Kbd>
    </CommandInput>
    <CommandList>…</CommandList>
  </CommandDialog>
  ```

- `dialog`, `alert-dialog`: radius 10, `shadow-dialog`, no border. `card`: `shadow-card` instead of a border.
- `checkbox` 16 px with a 1.5 px border, `radio-group` drawn the same (round, a `primary` dot), `switch` 26 × 16
  (thumb shadow in `SWITCH_THUMB_SHADOW_CLASS`, for a native switch drawn the same), `tooltip` dark without an arrow,
  `tabs` default to the `line` variant, `progress` 6 px.
- `table`: a 34 px header in `muted-foreground`, a line under the last row too.
- `sidebar`: a controlled sidebar keeps no cookie; the phone sheet's title and description are props; the menu
  skeleton's width is stable per item (shadcn draws a random one during render).
- `item`: inside an `ItemGroup` (a `role="list"`) every `Item` renders `role="listitem"`; an `asChild` item keeps its
  child's role (a link stays a link), so wrap it in an element with `role="listitem"`. `scroll-area`: the viewport
  takes `tabIndex={0}` so keyboard users can scroll it; `viewportProps` reach the viewport (`tabIndex: -1` removes
  the tab stop when the content has its own focusable elements).
- `sonner`: no `next-themes`; `theme` is a prop. Focus everywhere: `ring-2 ring-ring` instead of `ring-[3px]`.

A component the app needs beyond these: add it in this package (`npx shadcn@latest add <name>` in a scratch app,
then the deltas above), not in the app.

## Tokens

`NOTION_THEME` (`src/tokens.ts`, also exported as `theme`, the name every theme package uses) is the source, declared
with the kit's `defineTheme`; `tests/tokens.test.ts` keeps it equal to the design system's token snapshot
(`tests/fixtures/notion-tokens.json`). When the design system changes, refresh the snapshot and the definition in one
change. `cn` is `createThemeCn(NOTION_THEME)`. The build writes `theme.css` with the kit's `softure-theme-css` from
`softureTheme` in `package.json` (the kit README, "The theme package contract").

**Contrast.** Every text colour meets WCAG 2.2 AA (4.5:1) on the surfaces the parts put it on, in light and dark,
and the focus ring reaches 3:1 against the page; `tests/contrast.test.ts` lists the pairs and guards them. The values
are the design system's, shifted in lightness only (hue and chroma kept) where a pair fell short. Blue text is
`text-link`, not `text-primary`: `primary` is the fill under white text, and in dark no one blue serves both, so
`link` is a lighter blue there (in light both are `#0171cf`). The destructive fill is dimmed in dark
(`dark:bg-destructive/60`, as shadcn/ui's badge), so `destructive` in dark is the lighter text red. Inline code has its
own `code-foreground`, since the palette `red` falls short on the grey code chip.
Control boundaries and states reach 3:1 (SC 1.4.11): the `input` border of fields and select triggers, the
`control-off` switch track, the checked fill, the progress fill against its track (in dark the default fill is
`link`), and the selected pill of the default `Tabs` variant, which keeps its fill and shadow and draws an `input`
border outside its fill (`bg-clip-padding`), so the border reads against the list as well as the pill. Use `border-input` for a field's boundary only; a separator or a button outline uses `border-border`, which
is decoration and stays quiet.

**Overriding a token.** Redefine its CSS variable after `theme.css` (`:root { --primary: #e16259; }`, and the same in
a `.dark` block for the dark value), or build a variant with `extendTheme(theme, { name, colors: { … } })` and write
it with `buildThemeCss` (the kit README, "Overriding in an app").

## Testing

The suite keeps the package equal to the design system: a class that drifts fails a gate before merge. Layers 1–5
and 8 run in `npm test`; the visual and accessibility layers and the coverage threshold run in the `themes` workflow
on every pull request that touches `themes/`.

1. **Every export renders** (`tests/render.test.tsx`): one gallery case (`tests/gallery/cases.tsx`) per component,
   composition and `cva` variant × size, overlays open.
2. **Class parity** (`tests/parity.test.tsx`): every case's `data-slot` elements with their class strings equal
   `tests/fixtures/notion-slots.json`.
3. **Upstream guard** (`tests/upstream.test.ts`): each `src/ui` file equals the pinned shadcn new-york v4 source
   (`tests/upstream/*.tsx.txt`, commit in `tests/upstream/source.json`) with the deltas listed in
   `tests/upstream/deltas.ts`, each with its reason. A change nobody listed fails here.
4. **Behaviour** (`tests/behaviour/`): the sidebar's modes, phone sheet, cookie and labels; form controls; overlays
   (open, choose, close label, Escape, focus return); tabs; every message-layer prop.
5. **Tailwind generation** (`tests/tailwind-classes.test.ts`): every class written in `src/ui` and `src/notion` and
   every class in the parity fixture generates CSS on the theme (no unknown token, no cleared default colour).
6. **Visual regression** (`visual/gallery.spec.ts`): the gallery and each overlay at 1440 and 390 px, light and dark,
   against `visual/baselines/`, in Playwright's Chromium with fonts from npm packages.
7. **Accessibility**: axe (WCAG 2.1 A and AA, colour contrast included) on the same pages; the token pairs in
   `tests/contrast.test.ts` (see Contrast above) run in `npm test`.
8. **Inventory** (`tests/inventory.test.ts`): exports, files, the README's component list and the gallery agree.

Coverage of `src` stays at or above 90% of statements and branches (`npm run test:coverage -w @softure-ai/theme-notion`).

**Changing a component on purpose.** Edit the file, then in the same change:

- add or edit its entry in `tests/upstream/deltas.ts` (the upstream text, the package's text, why);
- refresh the parity fixture and review its diff:
  `UPDATE_FIXTURES=1 npx vitest run themes/theme-notion/tests/parity.test.tsx`;
- refresh the visual baselines and look at the changed images:
  `npm run test:visual -w @softure-ai/theme-notion -- --update-snapshots` (needs
  `npx playwright install chromium` once). The CI job uploads the expected, actual and diff images when a comparison
  fails.

A new component gets a case in `tests/gallery/cases.tsx` (and its `cva` axes in `CVA_AXES`), a pinned upstream file
when it comes from shadcn, and a line in the component list above.
