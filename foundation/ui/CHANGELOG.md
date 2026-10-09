# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/ui`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`ui@x.y.z`).

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
