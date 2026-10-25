# Changelog

Newest first. Each version lists what changed for an app that uses the theme. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

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
- `Steps` (#738): an ordered process (the stages of a multi-step task, the phases of a migration, the steps of one
  run) as an `<ol>`. Each step has a number in a badge coloured by its `state` (`done`, `current`, `todo` default,
  `failed`), a `title`, an optional `note` and an optional `aside`; layouts `row` (a wrapping grid of cards, the
  current one on `blue-bg`) and `list` (compact rows). The current step carries `aria-current="step"`, each state is
  also a screen-reader word (`stateLabels` replaces the English copy, `notionMessages.en.steps`), and
  `data-slot="steps"`, `data-step`, `data-state` mark the parts. An app that draws its own stage lists replaces them
  with `import { Steps } from "@softure-ai/theme-notion"` and maps its own stage status to the four states.

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
