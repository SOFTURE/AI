---
change_id: ui-app-components-407
---

# Research: ui-app-components-407

Sources: `foundation/ui/src/ui/*` (disclosure-menu, segmented-nav, segment-classes, button, modal, form-fields,
switch, field, form-context, confirm-action-button, locale, copy, icons), `foundation/ui/src/messages/*`,
`foundation/ui/tests/architecture.test.ts`, `eslint.config.mjs`, `modules/analytics/src/next/*`,
`context/foundation/lessons.md`, issue #407 and its comment.

- `useDisclosure` + `DisclosureMenu` (disclosure-menu.tsx) already give the menu behaviour the app shell needs:
  Escape, outside press, link click and `closeKey` close it. `DisclosureMenu` takes `label`, `icon`,
  `isLabelHidden`, `align`, `classNames` (`root`, `trigger`, `label`, `panel`). `MenuIcon` and `UserIcon` exist.
- `SegmentedNav` (server-safe) renders links with `aria-current` and takes `LinkComponent`; it knows nothing of
  query strings or scroll. `LinkComponentProps` is anchor attributes plus a string `href`, so a Next `Link` with
  `scroll={false}` must be wrapped by the adapter.
- ESLint forbids `next`/`next/*` imports in `src/ui/**` but not in `src/next/**`; modules with a Next adapter
  (analytics, auth) keep `next-modules.d.ts` for bare specifiers (L-002) and list `next` as a peer. Next 16.3.8 is
  installed at the root (the example app), so ui can type-check against it without a new devDependency.
- `Checkbox` (switch.tsx) already takes `required`, `error` and `onInvalid`; `CheckboxField` forwards neither.
  `useFieldError(name)` gives a replayed server error.
- `TextField`/`MoneyField` accept a controlled `value` + `onValueChange`; `MoneyField` reformats on blur with
  `normalizeAmountInput`. A controlled field does not replay a rejected submit by itself (`useFieldValue` gives the
  replayed text for the caller).
- `Modal` animates in with `@starting-style` (`starting:` classes on overlay and panel) and is unmounted by the caller
  on close, so a leave animation needs the modal to hold `onClose` until its transition ends. `ModalFooter` calls
  the caller's `onCancel` directly.
- `ConfirmActionButton` takes `action: () => Promise<ConfirmActionResult>`; `modalClassNames` and the `cancel` slot
  shipped in 0.1.17 (#372).
- Copy: server-safe components cannot read `UiLocaleProvider` (context is client-only); components with built-in
  text are client components or delegate to a small client part.
- `Button` already has `ink` and `ink-outline` variants.
- Guards: no raw colours, no inline copy (`findInlineCopy` reads JSX text and ARIA attributes), Tailwind classes name
  defined tokens, no `title` attribute, hover handlers need focus handlers, `createPortal` only in modal.tsx.
