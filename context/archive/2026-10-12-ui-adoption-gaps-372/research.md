---
change_id: ui-adoption-gaps-372
---

# Research: ui-adoption-gaps-372

Sources: `foundation/ui/src/ui/{confirm-action-button,modal,disclosure-menu,external-link,use-dismissed,locale,copy}.ts(x)`,
`foundation/ui/tests/adoption-gaps-319.test.tsx`, `foundation/ui/README.md`.

- `ConfirmActionButton` renders `Modal` without `classNames` and `ModalFooter` without `classNames`. `ModalFooter`
  already has a `cancel` slot added to the Cancel button's `className`; `ActionFormModal` already forwards
  `modalClassNames` to `Modal`. Both gaps are wiring only.
- `useDisclosure` listens on `document` in the capture phase for `pointerdown` (outside closes) and `click` (outside
  closes, link inside closes). With `click` only, an outside click still closes, after the click's target is fixed;
  focus moved by a pointer never closes (`focusin` closes only after keyboard input), so dropping the `pointerdown`
  close is enough.
- `external-link.tsx` starts with `"use client"`; in a React Server Components build every export of it, including
  `getExternalRel`, is a client reference, so a server module calling `getExternalRel` gets a stub. The only client
  need is `useUiLocale` (context). `getCopy` is server-safe (`copy.ts` has no directive), as are `class-names.ts`
  and `Card`, which shows the pattern: no directive, no hooks.
- `useDismissed` reads storage with `useSyncExternalStore`; the server snapshot is `"unknown"`, which counts as
  dismissed. An `initial: "shown"` option only changes how `"unknown"` is read. `isDismissalActive` treats any
  non-date value as not dismissed.
- `index.ts` re-exports every `ui/*` module with `export *`, so a new module needs a line there.
