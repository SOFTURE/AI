# Changelog

Newest first. Each version lists what changed for an app that uses the theme. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- Touch sizes for menus, tabs, accordion and dialog close (#880), the rest of #859. `DropdownMenuContent` gains
  `size` (`"default"` or `"touch"`) and so do `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`
  and `DropdownMenuSubTrigger`: a touch menu draws every row at least 44 px high (`min-h-touch-target`), and a row's
  own `size` wins over its menu's. `TabsList` (and `tabsListVariants`) gains `size`: a touch list drops its fixed
  36 px height and its triggers are at least 44 × 44 (`min-h-touch-target min-w-touch-target`); `TabsTrigger size`
  wins over the list's. `AccordionTrigger` gains `size="touch"` (`min-h-touch-target`). `DialogContent` gains
  `closeButtonSize="touch"`: the close button is 44 × 44 (`size-touch-target`) around the same icon. Defaults render
  as before. An app that wrote `min-h-touch-target min-w-touch-target` on these controls replaces it with the size.
- `MiniProgress` (#871): a compact bar with its figure inside, for a table cell or a tile. A 20 px `primary/12` track
  that takes the cell's width (at least 64 px), filled in `primary` (`link` in dark) or a `tone`'s colour; `value`
  0–100 clamped, `label` (default: the rounded percent) drawn in `foreground` on the track and in `background` clipped
  to the fill, AA on both in both schemes, truncated with an ellipsis in a narrow cell. A string label is the bar's
  `aria-valuetext`. An app that put a figure in a fixed-width span next to `Progress` (`flex gap-2` + `w-16` +
  `Progress`) swaps the pair for one `MiniProgress` and drops the widths.
- `UpdatePrompt` (#872): the offer to reload into a new build, for an installed app on `@softure-ai/pwa`. A floating
  `Alert` at the bottom of the screen inside the safe-area insets, with a reload `Button` at the touch height (`md:h-7`
  on a desktop); a polite `status`, drawn only while `open`. The copy is props, keyed like `pwaMessages.en.update`:
  `<UpdatePrompt open={isUpdateReady} onReload={activate} {...messages.update} />`.
- `InstallBar` (#873): the offer to install the app on a phone, for an app on `@softure-ai/pwa`. A floating `Alert`
  like `UpdatePrompt`, with the browser's install button (`offer="browser_prompt"`) or the two iOS steps, Share then
  Add to Home Screen (`offer="ios_steps"`), and a labelled close button, both at the touch size on a phone; nothing for
  `offer="none"`. The copy is props, keyed like `pwaMessages.en.install`:
  `<InstallBar offer={offer} onInstall={() => void install()} onClose={close} {...messages.install} />`.

## 0.9.0

- `Badge` and `Status` in a narrow container (#864): a badge is capped at its container's width (`max-w-full`), so a
  long word no longer runs past a card's edge. `Status` puts its word in a `<span data-slot="status-label"
  class="min-w-0 truncate">`: the word, not the icon, shrinks and ends in an ellipsis, and the badge's `title` is the
  full word when it is a string or a number (a new optional `title` prop sets it for any other node or overrides it).
  A plain `Badge` clips its text at the end (`justify-center-safe`, so a cut text keeps its start); an app that wants
  an ellipsis there wraps the text in `<span className="min-w-0 truncate">`. A badge whose text fits looks as before.
  An app drops its `max-w-full` on `Badge`/`Status` and its own truncating span inside `Status`; a selector that read
  `Status`'s text still finds it, now inside `status-label`.
- `SheetMenu`, `SheetMenuItem` and `SheetMenuButton` (#858): navigation rows for a side `Sheet` (a phone's drawer)
  that need no `SidebarProvider`. A row is full width, icon and label left-aligned in `foreground` (`text-ui`), 44 px
  tall on a phone and 34 px from `md`, hovered, pressed and active in `accent` like the sidebar's rows, `disabled`
  dimmed; `asChild` renders a link, `SheetClose asChild` around it closes the drawer. The README shows the drawer
  recipe: `showCloseButton={false}`, a ghost close `Button` in the `SheetHeader` row, the foot rows in a `SheetFooter`
  with `border-t`. An app that laid out ghost `Button`s as rows (`size="lg" className="min-h-touch-target w-full
  justify-start text-ui text-foreground"`) wraps them in `SheetMenu` / `SheetMenuItem`, swaps each `Button` for
  `SheetMenuButton` and drops those classes.
- Touch sizes (#859): the controls a phone view taps most reach the `touch-target` token (44 px). `Button` gains the
  sizes `touch` (`h-touch-target px-3`, the icon side padded like `lg`) and `icon-touch` (`size-touch-target`);
  `SelectTrigger` gains `size="touch"` (`h-touch-target`); `SelectContent` and `SelectItem` gain `size` (`"default"` or
  `"touch"`): a touch list draws every item at least 44 px high (`min-h-touch-target`), and an item's own `size` wins
  over its list's. The heights are plain classes, so a caller's breakpoint class (`md:h-7`, `md:size-7`,
  `md:min-h-7`) brings the pointer size back on a desktop. Existing sizes are unchanged. An app that used the
  workaround `min-h-touch-target min-w-touch-target` on a `Button`, `SelectTrigger` or `SelectItem` replaces it with
  the size (`size="touch"`, `size="icon-touch"`, or `size="touch"` on the `SelectContent`).

## 0.8.0

- Safe-area insets (#851): with `viewport-fit=cover` (an app installed on a phone's home screen), the parts at a
  screen edge no longer run under the notch, the status bar or the home indicator. `SheetContent` pads by the insets of
  the edges it touches (`right`: top, right, bottom; `left`: top, left, bottom; `top`: top, left, right; `bottom`:
  bottom, left, right), and its close button clears the top and right insets where the sheet touches those edges. The
  `Sidebar` on a phone keeps those insets (its sheet no longer carries `p-0`). The popper `SelectContent` caps its
  height by the inset on the side it opens towards. `PageFrame` pads by all four insets. The insets are 0 on a desktop
  and in a browser with its own bars, so nothing moves there. An app drops its `env(safe-area-inset-*)` classes on
  `SheetContent` and `SelectContent`; one that passes its own `p-*`/`pt-*`/`pb-*` to `SheetContent` replaces the inset
  on that edge and moves that padding to the sheet's children.

## 0.7.0

- `Timeline` (#838): a new composition for dated entries on one vertical rail: a marker in a palette colour with an
  optional icon, the time, title, description, badges and content, `compact` minor entries between major ones, a
  dashed rail for something missing, the body as a button (`onSelect`, `actionLabel`) and marks at the right edge
  outside it (`aside`). An app that drew a timeline from list rows with coloured left borders moves to `Timeline`.

## 0.6.0

- `FoldRow` (#832): the opened content (`fold-row-content`) is padded equally on all four sides (`p-3`, 12 px) instead
  of 24 px on the left and 4 px on the right, so a `DetailTable` sits centred under the row. `isInset` (default `false`)
  keeps the old indented look (`py-2 pr-1 pl-6`) and sets `data-inset="true"` on `fold-row-content` (`"false"` without
  it, as `StatsFold` does). New `summary` slot: a node drawn after the chevron in place of `title`, `facts` and
  `badges`; `details` and `detailsLabel` are now optional together (no table without them). An app that wants the old
  indent adds `isInset`; an app that drew rows "as `FoldRow` is" with its own markup for a custom summary or content
  passes `summary` and `children` and drops its copy of the classes. Existing calls compile unchanged.
- `Button` (#833): the `outline` hover no longer swaps the opaque `bg-background` for the translucent `bg-accent`; the
  accent is laid over the background as a gradient layer, so an outline button over a map or an image keeps its
  surface on hover (on the page it looks the same as before). A new `floating` variant is for a button that floats over
  content: opaque `bg-background` in every state, `text-foreground`, `shadow-menu` and no border, the `accent` tint on
  hover and the `accent-strong` tint while `aria-expanded="true"`, and a disabled state with muted text at full
  opacity. An app drops its `hover:bg-background hover:bg-linear-to-r hover:from-accent hover:to-accent` workaround
  and uses `variant="floating"` for map and image controls.
- `StatsFold` (#831): the content spans the heading row's full width by default, with the same left and right edges
  as the row; it was indented on the left only (`pl-6`), so a card or a full-width bar under the heading sat off-centre.
  The indented look is the new `isInset` prop (default `false`), which lines the content up with the title after the
  chevron. The content carries `data-inset="true|false"`. An app that wants the old look passes `isInset`; an app that
  undid the indent with its own class drops it.

## 0.5.0

- Needs `@softure-ai/theme-kit` `^0.1.4` (was `^0.1.3`): the version whose `softure-theme-css` writes `preflight.css`
  and the stylesheet re-exports (#795).
- `Command` (#809): `CommandDialog` passes its `title` to cmdk's `label`, so the palette's combobox is named by the
  dialog's title (it had an empty name: cmdk's `aria-labelledby` points at its hidden label and wins over an
  `aria-label` on `CommandInput`). A bare `Command` needs `label` from the app. `CommandInput` takes `children`,
  rendered after the input inside the input row (a `Kbd` "Esc" sits at its right end with no positioning), and
  `wrapperClassName`, merged into the row's classes (`h-12` for the 48 px row). An app drops its absolutely
  positioned `Kbd` beside `CommandInput` and its parent selector on `data-slot=command-input-wrapper`; a `label` it
  set on `Command` keeps working. Without the new props the classes are unchanged.
- `StatCards` (#813): a card takes an optional `icon` (a Lucide icon component, e.g. `icon: Wallet`), drawn before the
  label at 16 px with `ICON_STROKE_WIDTH` in the label's muted colour, 6 px apart, `aria-hidden`. An app that rebuilt
  the card from `Card` to show the icon goes back to `StatCards`. A card without `icon` renders as before.
- `base.css`, `preflight.css`, `maplibre.css` (#795): the kit's page stylesheets, exported by the theme as
  `@softure-ai/theme-notion/<name>.css`. Each is one `@import` of the kit's file, resolved from the theme's own dependency,
  so the app gets the kit version the theme was built against and needs no `@softure-ai/theme-kit` of its own. An app
  replaces `@softure-ai/theme-kit/` with `@softure-ai/theme-notion/` in its `globals.css` and drops a direct
  `@softure-ai/theme-kit` dependency it kept only for the CSS. The old imports keep working while the kit is hoisted.

## 0.4.0

- Server Components (#770): the package root imports from a React Server Component again. 0.3.0's `ui/item.tsx`
  created the `ItemGroup` context at module level without `"use client"`, so `next build` failed with
  `createContext is not a function` on any server page that imported from `@softure-ai/theme-notion`, even for
  server-safe parts such as `PageHeader` or `Empty`. The file is a client module now; `tests/repo/themes.test.ts`
  checks every theme so a file with a context or a component hook cannot ship without the directive. An app on 0.2.0
  moves to this version with no change of its own; an app on 0.3.0 drops any workaround that avoided the root import.
- `SortableList` covers what kept an app on its own dnd-kit wiring (#771); everything is opt-in, existing lists
  behave as before:
  - `disabled` on the list (read-only: no row lifts by touch, mouse or keyboard, rows stay clickable) and on a
    `SortableItem` (one row; wins over the list's). A disabled row carries `data-disabled` and no drag attributes; a
    disabled row's `SortableHandle` is a disabled button.
  - `group` on a `SortableItem`: a lifted row lands only among rows of its own group, by pointer and keyboard.
  - `onDragStart(id)`, `onDragEnd(id, move | null)` (every drop, `null` when the order stayed) and
    `onDragCancel(id)`; the list carries `data-sorting` while a row is lifted. The list's props no longer take the
    native HTML `onDragStart` / `onDragEnd` (dnd-kit never used native drag events).
  - `dragBy="activator"` with `SortableActivator`: the app's own element inside the row lifts it with the row's
    hold; a press elsewhere in the row does not. The keyboard picks up the focused row, which stays focusable.
  - `as="ol"`; children that are not a `SortableItem` stay in place.
  - Fix: a key pressed on a control inside a row (Enter on a button) no longer picks up the row in `row` mode.
  - Migration for an app with its own `DndContext` / `useSortable`: render `SortableList` (`as="ol"` for a numbered
    list, `disabled` for the read-only mode, `dragBy="activator"` with the row's button in `SortableActivator`),
    a `SortableItem` per row with `group`, and move the lift and drop side effects (hiding secondary content, a
    vibration) to `onDragStart` / `onDragEnd` / `onDragCancel` or to `group-data-[sorting]:…` classes. Drop the
    click grace timer after a drop: the click that ends a mouse drop never reaches the row. Remove the app's
    `accent-strong` / `shadow-menu` lifted classes and its `@dnd-kit/*` dependencies if nothing else uses them.

## 0.3.0

- Needs `@softure-ai/theme-kit` `^0.1.3` (was `^0.1.2`): the version whose `base.css` carries the border and outline
  colour rule (#746), which both wirings in the README import.
- Code and destructive Badge contrast (#763): inline `Code` and a destructive `Badge` with a `color` reach WCAG 2.2 AA
  (4.5:1) in light and dark; `tests/contrast.test.ts` guards the code pair.

  | Part | Light before → after | Dark before → after |
  | --- | --- | --- |
  | `Code` text: `red` → new token `code-foreground` | `#c8413d` → `#c33c39` (4.33 → 4.61 on `secondary`) | `#ea5e5b` → `#f86a66` (3.98 → 4.62 on `secondary`) |
  | `Badge variant="destructive" color="…"` text | the colour's tag text → `destructive-foreground` | `#d4d4d4` / `rgba(255, 255, 255, 0.81)` (3.98 / 4.46) → `#ffffff` on `destructive/60` |

  Lightness-only shift for the code red (OKLCH hue and chroma kept); `red` and every other part that uses it are
  unchanged. `Badge`: the `color` classes apply to every variant but `destructive` (cva `compoundVariants`, so
  `badgeVariants()` callers get it too); a destructive badge keeps its own fill and white text whatever `color` is.
  An app changes nothing, unless it styled code with `text-red` itself (move it to `text-code-foreground`) or relied
  on a colour on a destructive badge (use `variant="tag"` with the colour instead).
- Selected tab (#760): the selected pill of the default (`variant="default"`) `Tabs` list reaches WCAG 2.2 SC 1.4.11
  (3:1) against the list and the unselected tabs, in light and dark; before, the white pill on `muted` was 1.07:1 and
  the dark pill about 1.1:1. The active trigger draws an `input` border in both schemes (in dark it replaces
  `border-border`) and clips its fill to the padding box (`bg-clip-padding`), so the border sits on the list: 3.13
  against the list and 3.35 against the pill in light, 3.30 and 3.11 in dark. Fill, shadow and text colour are
  unchanged; the `line` variant keeps its underline and no border in both schemes; a focused tab still shows the
  `ring` border. No token changes. An app changes nothing, unless it restyles the active tab with its own
  `data-[state=active]:border-*` class.
- Non-text contrast (#759): control boundaries and states reach WCAG 2.2 SC 1.4.11 (3:1) against every page surface
  in light and dark; `tests/contrast.test.ts` guards the pairs. Alpha raised only, colour channels (hue) kept:

  | Token | Light before → after | Dark before → after |
  | --- | --- | --- |
  | `input` (field and select trigger border) | `rgba(15, 15, 15, 0.1)` → `rgba(15, 15, 15, 0.46)` | `rgba(255, 255, 255, 0.075)` → `rgba(255, 255, 255, 0.36)` |
  | `control-off` (switch off track, the bridge's `border-strong`) | `rgba(135, 131, 120, 0.3)` → `rgba(135, 131, 120, 0.95)` | `rgba(202, 196, 183, 0.15)` → `rgba(202, 196, 183, 0.5)` |

  Parts: the outline `Button` border and the `ButtonGroup` separator use `border` (their label identifies them, so
  they keep the old quiet weight); the dark active tab is `dark:border-border dark:bg-accent/40` (the same look as
  before); `Progress` fills in `link` in dark when `indicatorClassName` sets no fill colour, so the fill reaches 3:1
  against its track. Decorative separators (`border`, `sidebar-border`) are unchanged. An app changes: a
  `border-input` or `bg-input` of its own that only separates content (a divider, a button outline) moves to
  `border-border` / `bg-border`; its fields keep `border-input` and gain the contrast without a change.
- Fix (#746): table rows and the table footer, accordion items, default and destructive alerts, the command input,
  item media and sheets drew their borders in the text colour under Tailwind's full preflight. The rule that makes a
  border without a colour class the theme's `border` grey ships in `@softure-ai/theme-kit/base.css` (the kit's next
  release), which both wirings already import: update the kit, no other change.
- `touch-target` size (#742): `--spacing-touch-target: 44px` (Apple HIG 44 pt, WCAG 2.5.5 target size), so
  `min-h-touch-target` and `size-touch-target` give rows and controls tapped on a phone a finger-sized height next to
  the pointer sizes `control-height` 28 and `row-height` 34. No component changes height. An app that used the raw
  spacing scale for this (`min-h-11`) replaces it with `min-h-touch-target`, keeping the pointer height on desktop
  where it wants it (`min-h-touch-target md:min-h-row-height`).
- Contrast (#756): every text colour now meets WCAG 2.2 AA (4.5:1) on the surfaces the parts put it on, in light and
  dark, and the focus ring reaches 3:1; `tests/contrast.test.ts` guards each pair. Lightness-only shifts, hue and
  chroma kept:

  | Token | Light before → after | Dark before → after |
  | --- | --- | --- |
  | `muted-foreground`, `gray` | `#787774` → `#656461` | `#9b9b9b` → `#a5a5a5` |
  | `primary`, `sidebar-primary` | `#2383e2` → `#0171cf` | `#2383e2` → `#0171cf` |
  | `primary-hover` | `#0077d4` → `#0066b8` | `#0077d4` → `#0066b8` |
  | `link` (new) | `#0171cf` | `#409cfd` |
  | `destructive` | `#eb5757` → `#c63339` | `#eb5757` → `#fd6866` |
  | `ring`, `sidebar-ring` | `rgba(35, 131, 226, 0.57)` → `rgba(1, 113, 207, 0.8)` | → `rgba(64, 156, 253, 0.65)` |
  | `brown` / `orange` / `yellow` / `green` | `#9f6b53` / `#d9730d` / `#cb912f` / `#448361` → `#98644d` / `#af5a02` / `#986702` / `#3e7d5c` | unchanged |
  | `blue` / `purple` / `pink` / `red` | `#337ea9` / `#9065b0` / `#c14c8a` / `#d44c47` → `#2b77a2` / `#8a5faa` / `#ba4684` / `#c8413d` | purple `#9d68d3` → `#a974e0`, pink `#d15796` → `#dc61a0`, red `#df5452` → `#ea5e5b` |
  | `yellow-tag` | unchanged | `#89632a` → `#825c23` |

  Parts: the link variants of `Button` and `Badge` and hovered inline links (`Empty`, `Item`, `Field`) use the new
  `text-link`; `Button` destructive is `dark:bg-destructive/60` (hover `/50`) like `Badge`; `Badge` default hovers on
  `primary-hover`; tab triggers and the sidebar group label read `text-muted-foreground` instead of faded
  `text-foreground/60` and `text-sidebar-foreground/70`; the destructive `Alert` description is `text-destructive`;
  a focused destructive menu item in dark is tinted `destructive/10`. `Badge` destructive text is `text-destructive-foreground`: its
  `text-white` was never generated (the theme clears Tailwind's palette), so the label drew in the body colour. An app changes: blue text of its own
  (`text-primary` on text, a link colour) moves to `text-link`; a destructive fill of its own adds
  `dark:bg-destructive/60`; a hard-coded `#2383e2` or `#787774` moves to the token; text faded by an opacity
  modifier (`text-foreground/60`) moves to `text-muted-foreground`.
- `RadioGroup` and `RadioGroupItem` (#736): the shadcn new-york v4 `radio-group` (Radix), drawn like `checkbox`: 16 px,
  a 1.5 px `muted-foreground` border, the checked border and dot in `primary`, focus `ring-2 ring-ring`,
  `aria-invalid` like the other fields. Arrow keys move the choice. `data-slot="radio-group"`, `radio-group-item` and
  `radio-group-indicator` as in shadcn. An app that draws its own radio replaces it with
  `import { RadioGroup, RadioGroupItem } from "@softure-ai/theme-notion"`.
- Accessibility (#747): an `Item` inside an `ItemGroup` renders `role="listitem"`, so a group is a list with list
  items (axe `aria-required-children`); an `asChild` item keeps its child's role, wrap it in a `role="listitem"`
  element. The `ScrollArea` viewport takes `tabIndex={0}` and shows its focus ring on Tab (axe
  `scrollable-region-focusable`); the new `viewportProps` prop passes any viewport prop, `tabIndex: -1` included.
  Nothing to change in an app.
- `StatCard` (#739): optional `progress` (0–100, clamped) draws a 6 px bar under the figure with the package's
  `Progress`, filled in `TONE_FILL[tone]` when the card has a tone and in primary otherwise; `progressLabel` names it
  (default: `label`). Marked `data-slot="stat-card-progress"`. Cards without `progress` render as before. An app that
  rebuilt a budget card around `Progress` (e.g. "21.5 / 23.4 h") goes back to `StatCards` with `progress`.
- `Progress`: the value now reaches the Radix root, so the bar reports `aria-valuenow` and its state (it was always
  indeterminate to assistive tech before); a new optional `indicatorClassName` recolours the fill.
- Fixes (#735), class strings that sat on a neighbouring element since 0.1.0, now as in the design system and stock
  shadcn/ui new-york v4:
  - `Sidebar`: a `collapsible="none"` sidebar is again a full-height column on `bg-sidebar` (it was transparent); the
    phone sheet has no padding and no close button of its own (`p-0 [&>button]:hidden`), so it shows only the
    sidebar; the desktop gap animates its width again when the sidebar collapses.
  - `Checkbox`: the tick is 14 px (`size-3.5`) instead of lucide's 24 px default.
  - `Select`: the scroll-up arrow is 16 px (`size-4`); an item's icons and check are `muted-foreground` unless they
    carry a text colour of their own.
  - `FieldTitle`: 14 px in medium weight (`text-sm font-medium`, `items-center`), no longer `FieldLabel`'s peer and
    group markers.
  An app that overrode these classes by `className` to work around them can drop the override.
- `page.css` (#735): the design system's page base rules, `body` text at `text-sm` (14 px), `::selection` on
  `blue-tag` and `html` font smoothing. Add `@import "@softure-ai/theme-notion/page.css";` after the kit's `base.css`
  in `globals.css` (both README wirings show it); an app that kept those rules itself drops them.
- `FilterChip` and `FilterChipAdd` (#737): a list's filter pills as a Notion database view draws them, a 24 px
  `rounded-full` pill `icon · Label: value ▾` that opens a `DropdownMenu` of options (pass `DropdownMenu` items as
  children) in the design system's popover. `isActive` turns the pill into the blue tag and sets `data-active`;
  `data-slot="filter-chip"`, `filter-chip-value` and `filter-chip-add` mark the parts. `FilterChipAdd` is the
  "+ Add filter" pill; its text comes from `notionMessages.en.filterChip.add` and is replaced through `label`. An app
  that styled its own filter trigger replaces it with `import { FilterChip, FilterChipAdd } from "@softure-ai/theme-notion"`.
- `Code` and `CodeBlock` (#740): inline code (`text-code` mono, `red` on `secondary`, `rounded-xs px-1`) and a mono
  block on `muted` (`rounded-lg px-4 py-3`) that scrolls sideways, or wraps with `wrap`. `label` makes the block a
  named, focusable region. `data-slot="code"` / `data-slot="code-block"`. An app that writes these classes on its own
  `<code>` and `<pre>` replaces them with `import { Code, CodeBlock } from "@softure-ai/theme-notion"`.
- `Steps` (#738): an ordered process (the stages of a multi-step task, the phases of a migration, the steps of one
  run) as an `<ol>`. Each step has a number in a badge coloured by its `state` (`done`, `current`, `todo` default,
  `failed`), a `title`, an optional `note` and an optional `aside`; layouts `row` (a wrapping grid of cards, the
  current one on `blue-bg`) and `list` (compact rows). The current step carries `aria-current="step"`, each state is
  also a screen-reader word (`stateLabels` replaces the English copy, `notionMessages.en.steps`), and
  `data-slot="steps"`, `data-step`, `data-state` mark the parts. An app that draws its own stage lists replaces them
  with `import { Steps } from "@softure-ai/theme-notion"` and maps its own stage status to the four states.
- `SortableList`, `SortableItem` and `SortableHandle` (#752): a list whose rows are reordered by dragging, on the
  headless `@dnd-kit/core` and `@dnd-kit/sortable` (new dependencies of the package). A long press of 500 ms lifts a
  row on a touch screen (`holdDelay`, `tolerance` 8 px: a swipe before the hold scrolls, a tap still activates the
  row), the keyboard reorders with Space or Enter, the arrows and Escape, and the row moves only up and down. The
  lifted row is styled by the theme (`data-dragging`: `accent-strong`, `shadow-menu`, raised); every row is
  `touch-manipulation select-none` without the long-press callout. `items` (ids in order) and
  `onReorder(next, { id, from, to })` keep the order with the app. `instructions` and `announcements` (strings with
  `{item}`, `{position}`, `{total}`; English defaults in `notionMessages.en.sortable`) take the app's wording, and
  `getItemLabel` names a row. `dragBy="handle"` drags only by a `SortableHandle` grip button. An app that wired
  dnd-kit itself replaces its `DndContext`, sensors, `SortableContext` and the composed lifted-row classes with
  `import { SortableList, SortableItem } from "@softure-ai/theme-notion"`, passes its message-dictionary strings as
  `instructions` and `announcements`, and drops its own `@dnd-kit/*` dependencies unless it uses them elsewhere.
- A test suite in eight layers (#741, README "Testing"): every export rendered, a class parity fixture, a guard
  against the pinned shadcn new-york v4 sources with the listed deltas, behaviour, Tailwind generation, visual
  regression and axe (WCAG 2.1 AA, colour contrast included) in CI, inventory. Nothing for an app to change.

## 0.2.0

- Needs `@softure-ai/theme-kit` `^0.1.2` (was `^0.1.0`): the version that ships `base.css` and `maplibre.css`, which
  both wirings in the README import.
- README (#718): both wirings import the kit's `base.css` (the page base on `body`) and, for an app with MapLibre maps,
  `maplibre.css`. Needs `@softure-ai/theme-kit` with those files (the next kit release). An app that kept its own
  `body` rule (`margin: 0`, `background: var(--background)`, `color: var(--foreground)`,
  `font-family: --theme(--font-sans)`) or `body .maplibregl-map { font-family: … }` replaces them with the two
  `@import` lines after `theme.css`.
- `TabBar` (#723): a screen's tabs as line tabs where each tab is a link (`<a href>`), so the shown tab lives in the
  address and a link, a form's return or a reload land on the same tab. Optional icon before the label and count
  after it (0 included); the current link carries `aria-current="page"`; the row scrolls sideways on a phone.
  `data-slot="tab-bar"`, `data-tab` and `data-slot="tab-bar-count"` mark the parts. An app that keeps its own copy
  replaces it with `import { TabBar } from "@softure-ai/theme-notion"`; the props are the same (`label`, `tabs`,
  `current`). For client-state tabs keep `Tabs`.
- Tones (#720): `TONES`, `Tone` (`default`, `success`, `warning`, `danger`, `muted`), `TONE_COLORS` (a tone's palette
  colour, `null` for `default`) and the literal class maps `TONE_TEXT` (`text-*`), `TONE_FILL` (`bg-*`) and
  `TONE_EDGE` (`border-l-*`), generated by the shipped `theme.css`. Migration for an app with its own tone files:
  delete its `Tone` type and class maps, import them from the package, keep only the app's meaning-to-tone table,
  and drop any `@source` the app added for those class names.
- `SidePanel` (#724): a non-modal panel at a side of a canvas (a map) that leaves the canvas usable, unlike the modal
  `Sheet`. Layouts `over`, `beside`, `left`, `list`; hidden while closed, focus moves in when it opens, Escape and the
  close button call `onClose`. An app that kept its own copy replaces it with the import (same props; `closeLabel` is
  now optional, default "Close") and drops its own file.
- `PageHeader` takes `crumbsLabel` (#719): the accessible name of the breadcrumb it renders for `crumbs`, so an app
  in another language replaces the built-in English "breadcrumb". Without it the markup is unchanged.
- `MarkPopover` (#725): a counted tag (`badgeVariants({ variant: "tag", color })` with an icon and a count) that opens
  the design system's popover listing entries, on the browser's Popover API with no client state, phrasing
  elements only (`data-slot="mark"`, `data-slot="mark-popover"`). An app with its own copy of this mark deletes it
  and imports `MarkPopover` (and `MarkPopoverProps`) from `@softure-ai/theme-notion`: same props, same markup and
  classes; its domain marks (warnings, tickets) keep passing their entries as `role="listitem"` spans.
- `StatsFold`, `StatCards` and `StatPills` (#722): a screen's summary figures, folded under a heading (native
  `<details>`, closed by default), as a wrapping row of cards (label, figure in its tone, optional hint and aside tag,
  `isFullWidth` / `isOneRow` layouts) and as "label **value**" tags. `data-slot`, `data-stat`, `data-tone` and
  `data-layout` mark the parts. An app that kept these as its own code drops them and imports them from the package.
- `DetailTable` (#721): an item's details as a label and value table; rows without a value are left out, and nothing
  renders when no row has one. On a phone the label sits above its value.
- `FoldRow` (#721): an item as one folding list row (chevron, title, facts, tone badges) that opens in place to a
  `DetailTable` plus optional children; a native `<details>`, closed by default, no client state. `data-slot` names:
  `fold-row`, `fold-row-summary`, `fold-row-heading`, `fold-row-fact`, `fold-row-badges`, `fold-row-content`,
  `detail-table`.

## 0.1.1

- No change to the package itself: the first version published through the npm trusted publisher (OIDC) with
  provenance, without a token.

## 0.1.0

- First version (#708): `NOTION_THEME` (the Notion design system's tokens), `theme.css` (tokens, Tailwind
  utilities, `dark:` on the theme's scheme rule, tw-animate-css, the components as Tailwind sources), 36 shadcn/ui
  components with the Notion deltas, `Status`, `PageHeader`, `PropertyList`, `PageFrame`, `PALETTE_COLORS`,
  `ICON_STROKE_WIDTH`, `cn`, the built-in English copy with props to replace it, and `sft-bridge.css` for the pages of
  the SOFTURE packages.
- On the kit's theme package contract (#708): `theme` (the standard export, same as `NOTION_THEME`, declared with
  `defineTheme`), `softureTheme` in `package.json`, and `theme.css` built by the kit's `softure-theme-css` instead of
  a script of its own.
