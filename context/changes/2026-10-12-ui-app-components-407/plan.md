---
change_id: ui-app-components-407
status: active
---

# Plan: ui generic components (issue #407)

Input: change.md, research.md. Complexity: medium (eleven additive components and options, one new subpath).
Tests are written first in `foundation/ui/tests/adoption-gaps-407.test.tsx` (happy-dom) for each phase.

## Phase 1: form pieces

Files: `src/ui/form-fields.tsx`, new `src/ui/color-field.tsx`, `src/ui/suggested-amount-field.tsx`,
`src/ui/confirm-action-button.tsx`, `src/messages/{en,pl}.ts`, `src/ui/index.ts`.

1. `CheckboxField` takes `required` and `requiredMessage`: on `invalid` the native bubble is suppressed, the message
   shows under the checkbox (`aria-invalid`, `aria-describedby`), focus moves to it when it is the form's first
   invalid control; checking clears it. A replayed server error for `name` shows too. Without `requiredMessage` the
   browser's own validation stays.
2. `ColorField`: a hex text input (`#rrggbb`, `#rgb` expanded on blur, lowercase) plus a native colour input as the
   swatch, kept in sync; only the text input carries `name`. `normalizeHexColor(text)` is exported.
3. `SuggestedAmountField`: `MoneyField` plus a chip button "Use {amount}" that fills the suggested amount; keeps the
   replay of a rejected submit.
4. `ConfirmActionButton` takes `formAction(formData)` with `fields` (hidden inputs) as the alternative to `action`
   (a discriminated union): the dialog becomes a form whose confirm button submits it.

## Phase 2: app shell and lists

Files: new `src/ui/app-shell.tsx`, `src/ui/stepper.tsx`, `src/ui/checklist.tsx`, `src/ui/deferred-render.tsx`,
messages, index.

1. `AppHeaderBar` (server-safe): a sticky `<header>` with `brand`, `nav` (from `md`), `actions` and `mobileMenu`
   (below `md`) slots.
2. `AccountMenu`: a `DisclosureMenu` with `UserIcon`, the name and email at the top of the panel, links and a
   sign-out slot; `MobileMenu`: a `DisclosureMenu` with `MenuIcon` and the label hidden, a list of links with
   `aria-current`, `LinkComponent`, hidden from `md`. Labels from a new `appShell` message group.
3. `Stepper`: `<nav><ol>` of steps with icon or number, `aria-current="step"`, completed steps with a check and a
   screen-reader "completed"; only earlier steps navigate (`href` or `onStepSelect`); optional "Step 2 of 4".
4. `Checklist`: a list of `{ id, label, done, href }` with a done count; undone items with `href` are links.
5. `DeferredRender({ data, fallback, children })`: `Suspense` around a part that reads `data` with `use`.

## Phase 3: modal motion and the Next subpath

Files: `src/ui/modal.tsx`, new `src/next/{index.ts,query-segmented-nav.tsx,next-modules.d.ts}`,
`src/ui/query-href.ts`, `package.json` (`./next` export, `next` optional peer).

1. `Modal` `motion`: `enter` (default, as today) or `enter-leave`. Overlay and panel carry `data-state`
   (`open`/`closing`); with `enter-leave`, Escape, the backdrop, the close button and `ModalFooter`'s Cancel set
   `closing`, wait for the longest running transition or animation (none: at once) and then call `onClose`.
   `useModalClose()` gives an app's own buttons the same path.
2. `getQueryHref({ pathname, search, param, value, defaultValue })` (server-safe, in `ui`) and
   `QuerySegmentedNav` in `@softure-ai/ui/next`: `SegmentedNav` whose items set one query parameter, keep the
   others, and render Next's `Link` with `scroll={false}`.

## Phase 4: docs and dogfood

README (new components, `/next`, `UiLocaleProvider` once), CHANGELOG `## Unreleased`; the architecture test covers
`src/next` too.

## Progress

- [ ] Phase 1: form pieces
- [ ] Phase 2: app shell and lists
- [ ] Phase 3: modal motion and the Next subpath
- [ ] Phase 4: docs and dogfood
