# @softure-ai/ui

The design foundation every SOFTURE UI stands on: the `--sft-*` token contract with light and dark
defaults, a theme provider, a no-flash theme switch, the UI primitives every module builds its
screens from, and compiled CSS that needs no Tailwind in the app
([docs/02 §5](../../docs/02-module-standard.md#5-appearance-tokens-slots-overrides)).

## Install and wire up (Next.js App Router)

```css
/* app/globals.css: styles.css first, so its layer order is the one the browser keeps */
@import "@softure-ai/ui/styles.css";
@import "tailwindcss";                  /* optional: only if the app uses Tailwind 4 */
@import "@softure-ai/ui/tailwind.css";  /* optional: bg-accent, text-muted, rounded-card… on the tokens */
```

```tsx
// app/layout.tsx
import { SoftureThemeProvider, ThemeScript } from "@softure-ai/ui";

const theme = { light: { "color-accent": "#0b5" } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript theme={theme} />
      </head>
      <body>
        <SoftureThemeProvider theme={theme}>{children}</SoftureThemeProvider>
      </body>
    </html>
  );
}
```

`<ThemeSwitch />` anywhere renders Light · Dark · System (System is the default). Pass `design` to
`ThemeScript` and `ThemeSwitch` too when the provider gets one, so the browser bar colour matches.

**Locale.** `<SoftureThemeProvider locale="pl">` (or `<UiLocaleProvider locale="pl">`) sets the
built-in copy and the number notation of every component below it; a component's own `locale` prop
still wins, and without either it is `en`.

## Tokens

| Group | Tokens (`--sft-…`) | Per scheme |
| --- | --- | --- |
| Colour | `color-{background,surface,surface-raised,foreground,muted,border,border-strong,accent,accent-fill,accent-fill-hover,on-accent,danger,success,warning,focus,overlay}` | yes |
| Shadow | `shadow-{1,2}` | yes |
| Typography | `font-{sans,mono,heading}`, `text-{xs,sm,base,lg,xl,2xl,3xl,display}` | no |
| Shape and space | `radius-{control,card,pill}`, `space-{1…8}` (0.25 rem steps) | no |
| Motion | `duration-{fast,base,slow}` (160/200/240 ms), `ease-{out,in-out}` | no |
| Chart colour | `chart-{grid,axis,cursor,flag,on-flag}`, `chart-series-{1…6}` | yes |
| Chart size | `chart-{line-width,grid-width,dot-size,plot-height}` | no |

Chart tokens are read by `@softure-ai/charts/styles.css`, not by utilities, so the Tailwind bridge does not
map them. Their defaults copy today's roles (grid = border, axis = muted, cursor = border-strong, flag =
accent-fill). The six series colours are a palette in a fixed order, guarded for contrast and colour-vision
distance by `@softure-ai/charts` (its README, "Series palette", has the order, the measured margins and
`checkSeriesPalette` for an app's override).

The list lives in `src/theme/tokens.ts` (`SCHEME_TOKENS`, `SHARED_TOKENS`, `DEFAULT_THEME`); every
CSS file the package ships is generated from it.

## Overriding the theme

Three ways, from the most global:

1. **CSS.** Unlayered rules in the app beat the defaults, which sit in `@layer softure`:
   `[data-theme="dark"] { --sft-color-accent: #8f6; }`.
2. **`<SoftureThemeProvider theme={{ light, dark, shared }}>`.** `light` and `dark` take colours and
   shadows, `shared` takes the rest. Only the tokens you name are written. Values with `;`, `{`, `}`,
   `<`, `>` or a line break throw.
3. **`design.json`** (Impeccable, `schemaVersion: 2`): `<SoftureThemeProvider design={json}>`, or
   `themeFromDesignJson(json)`, which returns a `Result` with the theme and the roles it ignored.
   Role names map to tokens (`line-strong` → `color-border-strong`); `theme` overrides `design`.

`getThemeColors(theme)` gives the background of each scheme for Next's `viewport.themeColor`.

**Sections in a fixed scheme.** `<SoftureThemeProvider schemeScopes={{ dark: [".band-dark"], light:
[".band-paper"] }}>` (or `buildThemeCss(theme, { schemeScopes })`) gives every listed selector that
scheme's complete tokens, the defaults merged with `theme`, whatever the page theme is: a dark band in
a light page needs every colour, not only the overridden ones. Selectors with `;`, `{`, `}`, `<`, `>`
or a comment throw.

## Theme switch

- The choice lives in the cookie `sft-theme` (`light` | `dark`; absent = System). `ThemeScript`
  reads it before the first paint and sets `data-theme` on `<html>`; the server never reads it, so
  routes stay static. Use the same `cookieName` on `ThemeScript` and `ThemeSwitch` when you change it,
  and `cookieDomain` on the switch to share the choice across subdomains.
- `cookieDomain` is a fixed domain, a function of the current hostname called on each change
  (`(hostname) => domain | null`), or `{ apex: "https://example.com" }`, which a server component can pass:
  it shares the cookie when the page is on the apex or one of its subdomains and keeps it host-only elsewhere
  (`localhost`, an IP address, another host). The same rule is `getThemeCookieDomain(hostname, apex)`. A domain
  that is not a hostname throws.
- An app that already stores the choice keeps it: `cookieName="theme" cookieValues={{ light:
  "bright", dark: "night" }}` on both (and on `parseThemeCookie`, `buildThemeCookie`,
  `applyThemeChoice`). Values must be cookie octets and differ.
- With an explicit choice the browser bar follows it: `ThemeScript` recolours every `meta[name="theme-color"]`, also
  those Next inserts after the document is parsed (streamed metadata), as long as the page lives; after a switch
  to System, metas inserted later keep their own colour.
- With a strict CSP pass `nonce` to `ThemeScript`.
- `data-theme="light"` or `"dark"` on any element themes that subtree.
- Slots: `classNames={{ root, legend, options, option, input, label }}`; `unstyled` drops the
  defaults. Copy: `locale` (`en` default, `pl`) and partial `messages`.

## Primitives

| Group | Components and helpers |
| --- | --- |
| Actions | `Button` (`primary`, `secondary`, `ghost`, `danger`, `ink`, `ink-outline`; `sm`, `md`, `lg`; `pending`, `pendingLabel`), `ButtonLink`, `ButtonAnchor`, `IconButton`, `getButtonClass` |
| Icons | `ArrowLeftIcon` … `ChatIcon`, `ChildIcon`, `LoanIcon` (35, decorative, `size` and `className`) |
| Surfaces | `Card` (`boxed`, `lead`, `flat`; `step`, `done`, `accent`, `headingLevel`, `headingSize`, `collapsible`), `CardDisclosure`, `CollapsibleSection`, `Stat`, `EmptyState`, `Hint`, `FormError` |
| Fields | `Field`, `FieldGroup`, `TextField`, `PasswordField`, `MoneyField`, `SelectField`, `CheckboxField`, `INPUT_CLASS`, `NUMBER_INPUT_CLASS` |
| Controls | `Select` (ARIA listbox), `Switch`, `SwitchControl`, `Checkbox`, `SegmentedControl`, `SEGMENTED_GROUP_CLASS` + `SEGMENT_ACTIVE_CLASS` / `SEGMENT_IDLE_CLASS` (an app's own segments) |
| Navigation | `Tabs` (ARIA tabs, roving focus), `TabPanels` (panels for a tab bar of links), `SegmentedNav` (links drawn as segments, `aria-current`) |
| Dialogs and feedback | `Modal` (`form`, `confirmation`, `panel`), `StandingPanel`, `ModalBody`, `ModalFooter`, `ModalForm`, `ToastHost` + `announceToast` |
| Forms | `ActionForm` (server action, value replay, field errors, success toast), `ActionResult`, `MessageActionResult` |
| Locale | `UiLocaleProvider`, `useUiLocale` |
| Money | `parseAmount`, `formatAmountInput`, `normalizeAmountInput`, `getAmountErrorMessage` |

Server-safe (no `"use client"`): `Button`, `ButtonLink`, `ButtonAnchor`, `IconButton`, icons, `Card`, `Stat`,
`EmptyState`, `FormError`, `Field`, `FieldGroup`, `TabPanels`, `SegmentedNav`, the class constants. The rest are client components
(`Card` and `Field` render their hint and collapsing through small client components).

### Shared props

- **Slots.** Every component takes `classNames` with a typed slot list (`Card`: `root, header,
  titleRow, title, subtitle`; `Modal`: `overlay, panel, header, heading, title, subtitle, close`; …).
  An app class is added to the default and wins, because the defaults sit in `@layer softure`.
- **`unstyled`.** Drops every default class and keeps structure, ARIA and behaviour.
- **Copy.** Components with built-in text (`Modal`, `ModalFooter`, `StandingPanel`, `ActionForm`,
  `Card` hint and collapse names, field hint names) take `locale` (the provider's, else `en`; `pl`
  too) and partial `messages` for their group in `uiMessages`. Everything else the user reads (labels, titles, button text) comes from the app as
  props.
- **Links.** `ButtonLink` renders `<a>` unless you inject your router's link:
  `<ButtonLink LinkComponent={Link} href="/pricing" variant="primary">`. The package never imports
  `next/*`. `ButtonAnchor` is always a plain `<a>`, for what a router link must not handle: a download
  (`download`), an address outside the app, a full page load.
- **`className`** on `Button`, `ButtonLink` and `ButtonAnchor` is added to the root after `classNames.root`.

### Forms

```tsx
"use client";
import { ActionForm, MoneyField, TextField } from "@softure-ai/ui";

<ActionForm
  action={saveDebt}                       // (formData) => Promise<ActionResult>
  getErrorMessage={(code) => t(code)}     // codes from the server -> the app's copy
  submitLabel="Save"
  successMessage="Saved"                  // toast; render <ToastHost /> once per page
  onCancel={close}                        // optional: lay out as a Modal body and footer
>
  <TextField name="name" label="Name" required />
  <MoneyField name="amount" label="Amount" locale="pl" suffix="PLN" />
</ActionForm>
```

The action returns `{ ok: true }`, `ok()` or `ok(value)` (the form does not read the value), or
`{ ok: false, error: "app.code", fieldErrors?: { name: "app.code" } }`.

An app whose actions already return user-facing messages leaves out `getErrorMessage`: the action then returns a
`MessageActionResult` (`{ ok: false, error: "Could not save.", fieldErrors?: { name: "Too long." } }`) and the
form shows the strings as they are. The types keep the two apart: without `getErrorMessage` the action must return
messages, with it codes.

The submit button is `primary` unless `submitVariant` says otherwise. An app whose own forms
defaulted to `secondary` passes it on every form it migrates, or the forms turn to the accent fill.
While a save runs the button shows `pendingLabel` (the package's "Saving…" by default) and keeps
its width.
After a rejected submit the fields show what was typed (React resets the form) and their own
errors; `PasswordField` never replays. The server parses amounts with the same
`parseAmount(text, locale)` the field formats with. Between groups of three digits it accepts a space, a no-break
space (U+00A0), a narrow no-break space (U+202F) and a thin space (U+2009); `en` also accepts a comma.

`CheckboxField` renders a `Switch` (`labelAs="setting"`, the default) or a `Checkbox` (`labelAs="statement"`) and
replays its state after a rejected submit. `switchProps` (`classNames`, `controlClassNames`, `hintProps`) and
`checkboxProps` (`classNames`) reach the control it renders, so an app keeps its own look under `unstyled`:

```tsx
<CheckboxField name="notify" label="Notify me" hint="…" hintAs="tooltip" unstyled
  switchProps={{ classNames: appSwitch, controlClassNames: appSwitchControl, hintProps: appHint }} />
<CheckboxField name="terms" label="I accept the terms" labelAs="statement" unstyled checkboxProps={{ classNames: appCheckbox }} />
```

Number inputs (`TextField` with `inputMode`, `MoneyField`) use `NUMBER_INPUT_CLASS`: the mono face with
`tabular-nums` and `slashed-zero`, the placeholder in sans. It and `INPUT_CLASS` each carry exactly one font family
utility, so the two families never compete on one input.

### Surfaces, controls and feedback

```tsx
<Card title="Net worth" subtitle="3 accounts" hint="Assets minus debts" action={<IconButton label="Add">…</IconButton>}>
  <Stat label="Total" value="1,234,567.00" secondary="1,100,000.00 today" size="lg" />
  <Stat label="Debt" value="-12,000.00" tone="danger" />
</Card>
<Card title="Setup" step={2} done accent="success" headingLevel={3} collapsible defaultOpen>…</Card>
<EmptyState title="No goals yet">Add a goal to see your progress.</EmptyState>
<Hint label="About: Rate">Yearly interest rate before tax.</Hint>   {/* label names the "?" button */}
<Hint label="About: Rate" triggerGap={8}>…</Hint>                  {/* px between "?" and bubble; 6 by default */}
<Card title="Rate" hint="…" hintProps={appHint}>…</Card>            {/* appHint: HintAppearance, as the app's own hints */}
<TextField name="rate" label="Rate" hint="…" hintAs="tooltip" hintProps={appHint} />

<Select name="currency" aria-label="Currency" defaultValue="PLN"
  options={[{ value: "PLN", label: "PLN" }, { value: "EUR", label: "EUR" }]} />
<Switch name="included" label="Include in net worth" description="Counted in the total" defaultChecked />
<Switch name="notify" label="Notify me" hint="…" hintProps={appHint} stateText={{ on: "On", off: "Off" }} />
<Checkbox name="terms" label="I accept the terms" required />
<SegmentedControl legend="Period" isLegendHidden value={period} onChange={setPeriod}
  options={[{ value: "month", label: "Month" }, { value: "year", label: "Year" }]} />

<Tabs label="Views" items={[{ id: "chart", label: "Chart", content: <Chart /> },
  { id: "draft", label: "Draft", content: <DraftForm />, isAlwaysMounted: true }]} />
<SegmentedNav label="View" current={view} LinkComponent={NoScrollLink}
  items={[{ id: "chart", href: "?view=chart", label: "Chart" }, { id: "table", href: "?view=table", label: "Table" }]} />
<TabPanels active={tab} panels={[{ id: "overview", content: <Overview /> }, { id: "update", content: <Update />, isAlwaysMounted: true }]} />
<CollapsibleSection title="Goal" subtitle="3 of 5 set" headingLevel={2} defaultOpen>…</CollapsibleSection>

<ToastHost />                     {/* once per page, a polite live region */}
<ToastHost regionProps={{ "data-testid": "toast-region" }} />   {/* id and data-* only: an anchor for browser tests */}
announceToast("Saved");           // from any client code; the same text twice shows twice
```

`Select` is a select-only combobox: arrows, Home/End, PageUp/PageDown, typing to jump (matched with
`locale`), Enter or Tab to commit, Escape to close without a change; a hidden input sends the
value. Inside a container that animates in (a modal), the open list measures its trigger again when
the animation or transition ends. `Hint` opens on hover and focus, pins on click, and closes on an
outside press or focus leaving it; Escape closes it however it opened (hover and focus included).
Before hydration it already opens on hover and focus, by CSS alone. The bubble resets
`text-transform` and `letter-spacing`, so a hint inside an uppercase or tracked heading reads normally.
`Card`, `Field`, the form fields and `Switch` render their own "?"; `hintProps` (a `HintAppearance`: `classNames`,
`triggerGap`, `isWide`) gives it the look and gap of the app's standalone hints.

`Switch` and `Field` (with `hintAs="tooltip"`) put the "?" inline after the label: the label reserves its room at
the end of its last line (`pr-5`) and the wrapper (`hint` in `Switch`, `tooltip` in `Field` and the form fields)
draws it there with no advance of its own (`-ml-5 w-5`), so a wrapping label keeps the "?" next to its last word.
The row carries the label's font size, so a field's label row is as tall with a "?" as without one. `stateText` renders both lines and `:checked` shows one; that switching is behaviour, so under
`unstyled` the root keeps `sft:group/switch`, `state` keeps `sft:grid` and the lines keep their visibility classes,
while `stateOn` and `stateOff` take the app's look. An app's own `group-has-checked/switch:` classes need its own
`group/switch` on `classNames.root`. Ids follow the switch `id` (generated when omitted): `<id>-description` for the
description and `<id>-hint` for the hint bubble. Slots: `root`, `control`, `text`, `labelRow`, `label`, `hint`,
`state`, `stateOn`, `stateOff`, `description`; `controlClassNames` reaches the `SwitchControl` inside.

`Tabs` follows the WAI-ARIA tabs pattern: only the selected tab is in the Tab order, arrows move between tabs and
wrap, Home and End jump to the ends. `activation="automatic"` (default) selects the tab an arrow reaches; `"manual"`
moves focus only, and Enter or Space selects. Controlled with `value` + `onChange`, or uncontrolled with
`defaultValue`. Only the selected panel renders: a panel whose state must survive a switch (a form half filled) takes
`isAlwaysMounted` and stays in the tree, hidden. Slots: `root`, `list`, `tab`, `panel`.

When the route picks the tab (a path or a query parameter, so the choice survives a reload and works without
JavaScript), draw the bar with `SegmentedNav` and the content with `TabPanels`. `SegmentedNav` renders a named `<nav>`
of links with the segmented look; the current one carries `aria-current` (`page` by default, `ariaCurrent` to change).
`LinkComponent` renders each link: for a query-parameter switch with Next, a wrapper such as
`(props) => <Link {...props} scroll={false} />` keeps the scroll position. Slots: `root`, `link`. `TabPanels` renders
the active panel plus the `isAlwaysMounted` ones hidden, with `data-tab-panel` and no `tabpanel` role.

`CollapsibleSection` is the `CardDisclosure` gesture for any section: a framed bar with the arrow, the title and an
optional one-line `subtitle` (a state, such as "3 of 5 set") is the toggle (`aria-expanded`, `aria-controls`), and the
collapsed content stays mounted (`hidden`) so typed text survives. `headingLevel` (2–6) wraps the toggle in a heading.
Slots: `root`, `heading`, `toggle`, `arrow`, `title`, `subtitle`, `content`.

Every `text-*` size carries Tailwind's default line height (a ratio of the size token); an explicit
`leading-*` still wins.

### Modal

Render `<Modal title onClose>` while it is open. It moves focus in, keeps Tab inside, makes the rest
of `<body>` inert (live regions stay reachable), locks the page scroll and returns focus to the
opener. Escape closes it unless something inside handled the key first (an open `Select` list).
Pass `isDismissible={false}` while a save runs (`ActionForm onPendingChange`). The backdrop is the
`color-overlay` token.

`width="panel"` is a full-height sheet from the right (37.5rem, full screen on a phone) with the
footer at the bottom. `<StandingPanel isOpen title onClose>` is that sheet mounted for good: closed,
it is `hidden` and a draft typed inside survives; open, it is the dialog, and Escape from inside it
closes it (a confirmation `Modal` opened from the panel closes on its own Escape first).

Both render the title as `h2`; `headingLevel` (1–3) changes the element, not the look. A panel that is
the screen (an address of its own) passes `headingLevel={1}`, or `isOpen ? 1 : 2` when it stays
mounted closed on a page that has its own `h1`. The `cancel` slot of `ModalFooter` (and of `ActionForm`
with `onCancel`) is added to the Cancel button's look, like `Button`'s `className`. `ActionForm`'s `submit` slot
does the same for its submit button, in the page layout and in the modal footer.

A `Card` with `collapsible` turns its header into the toggle (its "?" and `action` stay clickable)
and keeps the content mounted while collapsed. `step` shows a numbered badge (a tick with `done`),
`accent` a short bar before the title in a semantic colour, `headingLevel` sets `h2`–`h4` and
`headingSize="section"` the larger title.

## Testing helpers (`@softure-ai/ui/testing`)

Colour guards for tests, plain functions with no test-runner import. Each check returns its failures as values,
so a test reads `expect(failures).toEqual([])` and a red run lists every failing pair at once.

```ts
import { DEFAULT_THEME, mergeThemes } from "@softure-ai/ui";
import { checkThemeContrast, DEFAULT_CONTRAST_PAIRS, findColorCollisions } from "@softure-ai/ui/testing";

it("our theme keeps WCAG AA contrast in both schemes", () => {
  const theme = mergeThemes(DEFAULT_THEME, appTheme);
  expect(checkThemeContrast(DEFAULT_CONTRAST_PAIRS, theme)).toEqual([]);
});

it("our series colours stay apart for colour-blind readers", () => {
  expect(findColorCollisions(["#2563eb", "#d97706", "#0f766e"])).toEqual([]);
});
```

- **Contrast:** `contrastRatio(a, b)` (WCAG 2, 1–21), `getContrastLevel(ratio, use)` with `use` `text` (AA 4.5,
  AAA 7), `large-text` (3, 4.5) or `non-text` (3, WCAG 1.4.11), `WCAG_CONTRAST`, `relativeLuminance`, and
  `blendColors(tint, ground, alpha)` for a composited `bg-x/10`.
- **Themes:** `checkThemeContrast(pairs, schemes?)` measures each `{ foreground, background, use, level? }` in the
  light and the dark set; `background` may be `{ tint, alpha, over }`. Without `schemes` it checks `DEFAULT_THEME`;
  it also takes an app's own token names and values. A missing token or a value that is not `#rrggbb`/`#rgb` (a
  `var()`) is reported, never guessed. `DEFAULT_CONTRAST_PAIRS` are the pairs this package's components paint; the
  package runs them on its own tokens, so a token change that breaks contrast fails its tests.
- **Colour vision:** `simulateColorVision(color, "protan" | "deutan" | "tritan")` (Viénot 1999 for protan and
  deutan, Machado 2009 for tritan), `colorDistance(a, b, { metric })` in CIEDE2000 (default) or CIE76,
  `minVisionDistance`, `labHue`, `hueDistance`, and `findColorCollisions(colors, { minDistance, visions, metric })`,
  which reports every pair closer than `minDistance` (default `DEFAULT_MIN_COLOR_DISTANCE`, 10 in CIEDE2000) in
  normal vision or a simulation. CIEDE2000 is the default because CIE76 inflates distances unevenly (1.4× for darks,
  up to 3.8× for blues), so one CIE76 threshold means something different per hue.

## How the CSS is built

`npm run build` runs `tsc`, then `scripts/build-css.mjs`, which compiles the components with the
Tailwind 4 CLI into `dist/styles.css` and writes `dist/tailwind.css`. It prints the gzip size and
fails above 20 kB (NFR-7).

- Components use Tailwind classes with the `sft:` prefix (`sft:bg-surface`, `sft:hover:text-foreground`).
  The package theme is `@theme inline reference prefix(sft)`, so every utility reads a `--sft-*`
  token and Tailwind emits no variables of its own. Durations have no Tailwind namespace:
  `sft:duration-(--sft-duration-fast)`.
- `styles.css` opens with `@layer theme, base, softure, components, utilities;`: softure sits above
  the app's resets and below the app's components and utilities, so an app class always wins.
  Imported after the app's Tailwind (for example from JavaScript after `globals.css`), softure would
  land above the app's utilities; keep the import order shown above.
- Raw colours are allowed only in `src/theme/`; `tests/architecture.test.ts` keeps them out of `src/ui/`,
  together with inline copy (JSX text and literal `aria-*`, `title`, `placeholder`, `alt`, `label`).
- A utility whose theme value is missing compiles to nothing, silently. `tests/styles.test.ts`
  therefore requires a compiled selector for every `sft:` class written in `src/ui/`; the static
  theme in `scripts/build-css.mjs` adds the base spacing, one breakpoint, two container widths,
  line heights (also the one each text size carries), tracking and the spinner animation.
