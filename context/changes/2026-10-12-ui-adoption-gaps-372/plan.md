---
change_id: ui-adoption-gaps-372
status: open
---

# Plan: ui adoption gaps (issue #372)

Input: change.md, research.md. Complexity: small (four independent additive options, one test file, docs).

## Phase 1: options and server-safe link (TDD)

Files: `foundation/ui/src/ui/confirm-action-button.tsx`, `disclosure-menu.tsx`, `external-link.tsx`, new
`server-external-link.tsx`, `use-dismissed.ts`, `index.ts`; test `foundation/ui/tests/adoption-gaps-372.test.tsx`.

1. Tests first, red on master:
   - `ConfirmActionButton` with `modalClassNames={{ panel, close }}` and `classNames={{ cancel }}` puts those classes
     on the dialog panel, its close button and the footer's Cancel.
   - `DisclosureMenu closeOutsideOn="click"`: an outside `pointerdown` keeps it open, the outside click closes it;
     the default still closes on `pointerdown`. Same through `useDisclosure`.
   - `ServerExternalLink` renders the same markup as `ExternalLink` with `locale="pl"` and no provider;
     `server-external-link.tsx` has no `"use client"` and no `use*` hook call; `getExternalRel` is exported from it.
   - `useDismissed(key, days, { initial: "shown" })`: server render (`renderToString`) shows the banner, default
     hides it; after hydration a stored dismissal still hides it.
2. Implement: `ConfirmActionButtonSlot` adds `cancel`; `modalClassNames?: ClassNames<ModalSlot>` passed to `Modal`;
   `classNames.cancel` passed to `ModalFooter`. `UseDisclosureOptions.closeOutsideOn`, forwarded by
   `DisclosureMenu`. `ServerExternalLink` + `getExternalRel` in `server-external-link.tsx`; `ExternalLink` resolves the
   locale and renders it. `UseDismissedOptions { initial }` as a third argument.

## Phase 2: docs

`foundation/ui/README.md` (the four options, server link, migration snippet), `foundation/ui/CHANGELOG.md`
(`## Unreleased`).

## Progress

- [ ] Phase 1: options and server-safe link
- [ ] Phase 2: docs
