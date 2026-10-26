# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/ui`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`ui@x.y.z`).

## Unreleased

- `DisclosureMenu` (and so `AccountMenu` and `MobileMenu`): the panel's link rules no longer restyle a `ButtonLink`
  placed in the panel (#777). Links that carry `data-variant` keep their own display, padding and colours; the panel's
  rules for other links now have zero specificity (`:where()`), so an app's own class on a link wins over them. Plain
  links look as before.

Migration for an app that reset the panel's link rules through `classNames.panel` (e.g. `[&_a]:inline-flex
[&_a]:px-4 [&_a]:py-0 [&_a:not(:hover)]:text-muted`): drop those resets. A `ButtonLink` in the panel now looks as it
does everywhere else; as a flex item of the column panel it stretches to the panel's width, so wrap it in a
`<div>` if it should keep its own width.

## 0.3.4

All additive (#623); existing calls keep their markup and names.

- `EyeOffIcon`: the `EyeIcon` drawing crossed out by a corner-to-corner slash, for the hidden side of a show / hide
  toggle.
- `IconButton` shows a pressed look at `aria-pressed="true"`, in both tones: the accent fill, `on-accent` text and an
  inset ring in the text colour (the look of a chosen segment, a cue that does not rely on colour), kept on hover. A
  button without `aria-pressed`, or with `aria-pressed={false}`, looks as before.
- `IconProps` is part of the public API (it already was through the root export; a test now keeps it there).

Migration for an app with its own toggle styling:

1. Replace the local crossed-eye icon with `import { EyeOffIcon } from "@softure-ai/ui"`, e.g.
   `<IconButton label="Show series" aria-pressed={!isHidden}>{isHidden ? <EyeOffIcon /> : <EyeIcon />}</IconButton>`.
2. Drop the app's `[aria-pressed="true"]` CSS rule and the `classNames.root` that only carried it; set `aria-pressed`
   on the `IconButton`. Keep `classNames.root` only to restyle the pressed look.
3. Type an app's own icon component with `import type { IconProps } from "@softure-ai/ui"`.

## 0.3.3

All additive (#558); existing calls keep their markup, names and look.

- `AccountMenu` takes `trigger` (`ReactNode`), shown in the button instead of the `UserIcon`, e.g. the account's
  initial in a circle. The button keeps its name from `messages.accountMenu` ("Account").
- `DisclosureMenu` (and so `AccountMenu` and `MobileMenu`) animates its panel out as well as in. The panel carries
  `data-state="open" | "closed"`, enters with `@starting-style` (a short fade and lift on `--sft-duration-fast`) and,
  on close, stays shown and inert to the pointer until its transition ends, then gets `hidden`. Under
  `prefers-reduced-motion` nothing runs and it hides at once. `useDisclosure` is unchanged: markup an app builds on
  `panelProps` still hides straight away. An app with its own motion can key it on `data-state` through
  `classNames.panel`.
- `MobileMenu.items` takes groups, `{ heading, items }` (`MobileMenuGroup`), next to plain links; a group is an `<li>`
  with its heading and a nested list named by it. New: `isMobileMenuGroup`, `MobileMenuEntry`, slots `group`,
  `heading`, `groupList`.
- `ColorField` takes `presets` (`{ value, label }[]`, `ColorPreset`): a row of swatches above the input, a radio group
  named by the new `colorField.presets` message ("Preset colours: {label}", overridable through `pickerMessages` or
  the provider), each swatch named by its `label`. A click or an arrow key fills the field with the preset's
  `#rrggbb`; the swatch matching the value is checked. The swatches are buttons, so the form data still holds only
  `name`. New slots `presets`, `preset`.

Migration for an app that kept its own header menus and colour field:

1. Replace the account menu with `<AccountMenu trigger={<YourInitialCircle />} …>`; keep its links as `children` and
   the sign-out as `footer`. Drop the app's own exit-transition code; restyle the motion with `classNames.panel` and
   `data-[state=closed]:` classes if the defaults do not fit.
2. Replace the phone menu with `<MobileMenu items={[{ heading: "App", items: […] }, { heading: "Account", items: […] },
   { heading: "Help", items: […] }]} />`; the headings are the app's own text.
3. Replace the preset row next to the picker with `<ColorField presets={[{ value: "#…", label: "…" }, …]} />`, and
   pass the app's wording for the group's name as `pickerMessages={{ presets: "…" }}` (or the provider's
   `colorField` group).

## 0.3.2

- `AppHeaderBar`'s `inner` row is `box-sizing: border-box`, so its padding stays inside the full width in an app
  without a global `box-sizing` reset (Tailwind's preflight or similar). Before, the row was 2rem wider than the
  viewport, cut the actions at the right edge and let the page scroll sideways (#542). No change in an app that
  already has the reset; the `classNames={{ inner }}` workaround can go.

## 0.3.1

- `SuggestedAmountField` covers a suggestion row an app drew itself (#507). `suggestedValue` takes `null` (or is left
  out) when there is nothing to suggest: the row shows `messages.none` ("No suggestion") and no button.
  `suggestionHint` puts a "?" after the action that explains the suggestion or its absence, named by the new
  `hintLabel` / `noneHintLabel` messages with the field's label; `suggestionHintProps` gives it the app's hint look.
  `suggestionVariant="inline"` renders `{suggested} {useShort}` ("Suggested: 120 000,00 PLN use") as one small muted
  row with a text button named by `use`. New slots `suggestionRow` and `suggestionText`. Existing calls keep the same
  chip, name and behaviour; the chip's top margin moved from the `suggestion` slot to the new `suggestionRow`.
  Migration for an app with its own `Suggested: {amount} <button>use</button> <Hint/>` row: drop the row and pass
  `suggestionVariant="inline"`, `suggestedValue` (or `null`) and the explanation as `suggestionHint`; its own wording
  goes into `suggestionMessages` or the provider's `suggestedAmount` group.
- `Checklist` takes `rowLink` (the whole row, marker to trailing node, is one link), `trailing` (a node or
  `(item, { isLink }) => node` after the body, e.g. a chevron) and `linkDone` (a done item with `href` links too) (#506).
  All are off by default, so the markup stays the same. New slots: `row`, `trailing`.

## 0.3.0

- **Breaking (#446):** the built-in `pl` dictionary is gone; `uiMessages` is English only and `locale` is any BCP 47
  tag. An app that shows another language passes its own translation as `messages` (per component or through the
  provider); a key it leaves out reads English. The amount and decimal fields read their notation from
  `Intl.NumberFormat` for any locale (`pl` and `en` keep their behaviour).
- `QuerySegmentedNav` (`@softure-ai/ui/next`) renders outside the App Router, where `useSearchParams()` and
  `usePathname()` return `null` (a static render in a unit test, the Pages Router): the query counts as empty and the
  links are query-only. A new optional `active` prop takes the view the server parsed and wins over the address (#454).
- `UiLocaleProvider` and `SoftureThemeProvider` take `messages`: the app's own translation of the built-in copy, per
  message group, used by every client component below them (#435). A component's own `messages` win key by key.
  `UiLocaleProvider`'s `locale` is now optional (`en` when left out).
- `CheckboxField` takes a node as `label` in both modes (#453), so a consent statement can link to the terms; the
  control is still named by the label's text. `switchProps` also takes `hintLabel`, the name of the "?" when a
  `setting` has a node label and a tooltip hint.

## 0.2.0

- Source guards in `@softure-ai/ui/testing` for an app's design system (#403): `findUndefinedTokenClasses` (Tailwind
  colour, `ease-*` and `duration-*` classes must name a defined token), `findNativeTooltips` (no `title` attribute
  on HTML elements), `findHoverOnlyHandlers` (what opens on hover opens on focus) and `findRestrictedElements` (raw
  `<select>` and `createPortal` only in their one file). `typescript` is a new optional peer dependency, needed by
  `@softure-ai/ui/testing` (not by the components). The package runs all four guards on its own components.
- Generic components an adopting app still owned (#407):
  - App shell: `AppHeaderBar` (server-safe sticky bar: brand, navigation from `md`, actions, phone menu),
    `AccountMenu` and `MobileMenu` (both on `DisclosureMenu`, named by the new `appShell` messages).
  - `CheckboxField` takes `required` and `requiredMessage`: a consent left unchecked shows the message under the box
    instead of the browser's bubble and takes focus when it is the first invalid control. `Switch` and
    `SwitchControl` take `required`.
  - `Stepper` (back-only navigation through `href` or `onStepSelect`, `aria-current="step"`), `Checklist` (an
    onboarding list with a done count), `ColorField` (hex text with a colour picker swatch, `normalizeHexColor`),
    `SuggestedAmountField` (a `MoneyField` with a "Use {amount}" chip) and `DeferredRender` (a Suspense streaming
    helper). New message groups `appShell`, `stepper`, `checklist`, `colorField`, `suggestedAmount` (`en`, `pl`).
  - `Modal` takes `motion="enter-leave"`: closing from inside waits for the leave transition, with `data-state`
    (`open`, `closing`) on the overlay and the panel for an app's keyframes; `useModalClose()` gives an app's own
    close button the same path. `ConfirmActionButton` and `ActionFormModal` take `modalMotion`.
  - `ConfirmActionButton` takes `formAction(formData)` with hidden `fields` as the alternative to `action`. Its props
    type is now a type alias (`ConfirmActionButtonProps`, with the `ConfirmActionRun` union), so an app that
    `extends` it switches to `&`.
  - A new `@softure-ai/ui/next` subpath with `QuerySegmentedNav`: segments that switch a view through one query
    parameter, keep the other parameters and navigate with `Link scroll={false}`. `next` is a new optional peer
    dependency, needed only by this subpath. `getQueryHref` (main entry) builds the same addresses.
  - The CSS gains the `md` breakpoint (48rem) for the app bar.
  - README: mounting `UiLocaleProvider` once replaces the per-call `locale`/`messages` props.

## 0.1.17

- Four gaps in the interaction components, found adopting them (#372):
  - `ConfirmActionButton` takes `modalClassNames` (the dialog's `Modal` slots) and a `cancel` slot for the footer's
    Cancel button.
  - `useDisclosure` and `DisclosureMenu` take `closeOutsideOn: "pointerdown" | "click"` (`pointerdown` by default):
    `click` keeps a panel in the document flow open until the outside click lands.
  - `ServerExternalLink`: `ExternalLink` without client code, the locale and copy by props. `getExternalRel` moved
    to that server-safe module (same import from `@softure-ai/ui`), so a server component can call it.
  - `useDismissed(key, days, { initial })`: `"shown"` renders the notice before hydration (prerendered HTML contains
    it); `"dismissed"` stays the default. The README shows how to migrate a value stored in another format.

## 0.1.16

- `TextField` and `MoneyField` can be controlled: `value` with `onValueChange` (the text after every edit). A
  controlled `MoneyField` reports the reformatted amount through `onValueChange` on blur instead of rewriting the
  input; a rejected submit does not replay into a controlled field. Uncontrolled fields keep their behaviour and
  also accept `onValueChange` to observe edits. The props types are now type aliases (`TextFieldProps`,
  `MoneyFieldProps`, with the new `FieldValueProps` union), so an app that `extends` them switches to `&` (#320).
- `parseDecimal(text, locale, { scale })`, `formatDecimal(units, locale, { scale, minFractionDigits? })` and
  `normalizeDecimalInput`: `parseAmount`'s digit grammar at any scale from 0 to 15, as an integer count of
  10^-scale units (a percent in basis points at scale 2, a rate in millionths at scale 6). Errors are
  `ui.decimal_invalid` and `ui.decimal_out_of_range`. `parseAmount`, `formatAmountInput` and
  `normalizeAmountInput` are now their scale-2 case, with unchanged results and error codes (#320).
- New interaction components an adopting app kept writing itself (#319):
  - `useDisclosure` + `DisclosureMenu`: the WAI-ARIA disclosure for navigation. Escape returns focus to the
    trigger; an outside `pointerdown` or `click`, heard in the capture phase, closes it; so do a link click inside,
    a new `closeKey` (the route) and focus leaving by keyboard.
  - `ConfirmActionButton`: a destructive action behind a `confirmation` dialog that states the stakes; the server's
    message goes to `announceToast`, an error stays in the dialog, nothing expires on a timer.
  - `ActionFormModal` and `ModalTrigger`: an `ActionForm` in a `Modal`, opened by a "+" `IconButton`, closed after
    a successful save.
  - `CopyButton` (and `writeToClipboard`): copied and failed states, a selected read-only field to copy by hand
    without a secure context.
  - `ExternalLink`: a new tab, `rel="noopener noreferrer"` plus the app's tokens, a screen-reader note.
  - `useDismissed(key, days)`: dismiss a banner for N days; a date-only value, storage errors never throw.
  - New message groups `confirmAction`, `copyButton` and `externalLink` (`en`, `pl`).
- `SegmentedControl`'s checked segment and `SEGMENT_ACTIVE_CLASS` carry an inset ring in the text colour next to
  the accent fill, a cue that does not rely on colour: a light accent (lime on white, 1.27:1) no longer fails
  WCAG 1.4.11 (#319).
- `Switch` takes `aria-label`, which overrides the visible `label` as the switch's accessible name, e.g. a switch in a
  table row whose label names the column while the name must also name the row (#339). Before, `SwitchProps` omitted
  it, though the input already received it at runtime. `aria-describedby` stays driven by `description`.
- `CheckboxField` takes `switchProps` (`classNames`, `controlClassNames` and `hintProps` of `Switch`) for `setting`
  and `checkboxProps` (`classNames` of `Checkbox`) for `statement`, and passes them to the control it renders, so an
  app can draw the field in its own look under `unstyled` and keep the submit replay (#340). Before, it forwarded
  only `unstyled`, `locale` and `messages`. The id stays generated when omitted; pass `id` for a stable selector.

## 0.1.15

- Number inputs render in the mono face again. `NUMBER_INPUT_CLASS` was built on `INPUT_CLASS`, so it carried both
  `sft:font-sans` and `sft:font-mono`, and the sans rule, later in `styles.css`, won: every `MoneyField` and numeric
  `TextField` drew in sans. Both looks now share a frame without a family and add exactly one (#302).
- `parseAmount` (and so `MoneyField` and `normalizeAmountInput`) accepts a thin space (U+2009) between groups of
  three digits in both notations, next to a space, U+00A0 and U+202F. The rule stays strict: groups of exactly three
  digits (#303). Before, `"1\u2009234,56"` was `ui.amount_invalid`.

## 0.1.14

- `Switch` takes `hintProps` (`HintAppearance`), like `Card` and `Field`, so its "?" matches the app's other hints.
- `Switch` slots `stateOn`, `stateOff` (the two state lines) and `hint` (the wrapper of the "?"). Under `unstyled`
  the state lines keep switching: the root keeps `sft:group/switch`, `state` keeps `sft:grid` and each line keeps its
  visibility classes. Before, both lines showed at once.
- `Switch` lays the "?" inline after the label (block row, `pr-5` on the label, `-ml-5 w-5` on the wrapper) instead
  of a flex row, so a wrapping label keeps the "?" next to its last word. The markup gains the wrapper `span`.
- Documented: the description id is `<id>-description` and the hint id `<id>-hint`.
- `Field` and the form fields (`TextField`, `PasswordField`, `MoneyField`, `SelectField`) lay a tooltip "?" the same
  way, in a new `tooltip` slot (the wrapper of the "?"; `hint` stays the block hint). The label row is a block with
  the label's font size: with a "?" it is now 20 px tall like a row without one (it was 24 px), so the control
  below moves up 4 px and fields with and without a hint line up side by side.

## 0.1.13

- `Tabs`: ARIA tabs with roving focus (arrows wrap, Home and End), `automatic` or `manual` activation, controlled or
  uncontrolled; only the selected panel renders unless a panel is `isAlwaysMounted` (kept, hidden).
- `TabPanels` (server-safe): the panels of a tab bar made of links, the active one plus the always-mounted ones hidden.
- `SegmentedNav` (server-safe): links with the segmented look in a named `<nav>`, `aria-current` on the current one,
  `LinkComponent` for a framework link.
- `CollapsibleSection`: a framed section whose bar (arrow, title, `subtitle`) toggles content kept mounted;
  `headingLevel` wraps the toggle in a heading. It shares its arrow with `CardDisclosure`, whose markup is unchanged.

## 0.1.12

- `ActionForm` takes a `submit` slot, added to the submit button's classes in both layouts (page form and modal
  footer with `onCancel`), so an app that styles its buttons through `className` reaches the form's submit button
  without child selectors.

## 0.1.11

- `Card`, `Field` and the form fields (`TextField`, `PasswordField`, `MoneyField`, `SelectField`) take `hintProps`
  (`HintAppearance`: `classNames`, `triggerGap`, `isWide`) for their "?" hint, so it matches the app's standalone
  `Hint`s in look and gap.
- `Modal` and `StandingPanel` take `headingLevel` (1–3, `h2` by default) for the title element.
- `ModalFooter` and `ActionForm` (with `onCancel`) take a `cancel` slot, added to the Cancel button's classes.

## 0.1.10

- `ThemeScript` (`getThemeBootScript`) recolours `theme-color` metas inserted after `DOMContentLoaded` too (Next's
  streamed metadata, React hoisting): a mutation observer applies the current `data-theme` to each one as it
  lands. Before, only the metas present at `DOMContentLoaded` followed an explicit choice on the first load.

## 0.1.9

- `ThemeSwitch` `cookieDomain` also takes a function of the current hostname or `{ apex }` (serializable, for a
  server component); `getThemeCookieDomain(hostname, apex)` gives the apex for the apex and its subdomains and `null`
  for `localhost`, IP addresses and other hosts. `buildThemeCookie` rejects a domain that is not a hostname.
- `ActionForm` without `getErrorMessage` takes an action returning `MessageActionResult` (ready user-facing messages)
  and shows them as they are; with it, codes as before.
- `Button`, `ButtonLink` and the new `ButtonAnchor` (a plain `<a>` with the button look) take `className`.

## 0.1.8

- Described in the GitHub Release `ui@0.1.8`.
