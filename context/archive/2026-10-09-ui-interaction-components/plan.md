---
change_id: ui-interaction-components
status: archived
---

# Plan: interaction components in ui (issue #319)

Input: change.md (research and framing skipped, reasons there). Complexity: medium (six small client components,
one class change, docs).

## Today (master `4af1614`)

- `Modal` (`modal.tsx`) already returns focus to its opener, makes the page inert and answers Escape;
  `ModalBody`, `ModalFooter` (Cancel, `error`, `isPending`) build a confirmation.
- `ActionForm` (`action-form.tsx`) lays itself out as a modal body and footer with `onCancel` and reports
  `onPendingChange`; `onSuccess` fires after a successful submit.
- `IconButton`, `Button` (`pending`), `PlusIcon`, `CopyIcon`, `CheckIcon` exist (`button.tsx`, `icons.tsx`).
- `announceToast` (`toast.tsx`) shows a message in the page's `ToastHost`.
- `SegmentedControl` marks the checked option only with `has-checked:bg-accent-fill`; `SEGMENT_ACTIVE_CLASS` only
  with `bg-accent-fill`.
- Copy groups live in `src/messages/{en,pl}.ts`; `tests/architecture.test.ts` refuses inline copy and raw colours.

## Decisions

1. **`useDisclosure({ closeKey })`** returns `isOpen`, `open`, `close`, `toggle` and prop getters for the trigger
   and the panel (ids, `aria-expanded`, `aria-controls`, refs). While open: Escape closes and returns focus to the
   trigger; a `pointerdown` or `click` outside trigger and panel, listened to in the capture phase on `document`,
   closes (a handler that stops propagation before hydration cannot hide it); a click on a link inside the panel
   closes; a change of `closeKey` (the app passes its pathname) closes; `focusout` to outside closes only when the
   last input was the keyboard (a pointer moving focus is handled by the outside press).
2. **`DisclosureMenu`**: a button (`label`, optional `icon`, `isLabelHidden`) plus a panel (`hidden` while closed)
   with the app's links as children. Slots `root`, `trigger`, `panel`. No `role="menu"`: APG disclosure navigation.
3. **`ConfirmActionButton`**: a trigger `Button` (`danger` by default, or an icon-only `IconButton` with `icon` and
   `isIconOnly`) opens a `Modal` `confirmation` with the stakes (`description`) and a footer with Cancel and the
   confirm button. `action: () => Promise<ConfirmActionResult>` (`{ ok: true, message? }` or `{ ok: false, error }`):
   success closes and announces the server message (else `successMessage`) through `announceToast`; failure keeps
   the modal open with the error in the footer until the user acts (no timer); a rejected promise shows the package's
   `failed` copy. While it runs the modal is not dismissible.
4. **`ActionFormModal`** = `Modal` + `ActionForm` with `onCancel`, closing on success and not dismissible while
   saving. **`ModalTrigger`** = a bordered `IconButton` (`label`, `PlusIcon` by default) that opens an
   `ActionFormModal` and returns focus to itself on close (the modal's own focus return).
5. **`CopyButton`**: `navigator.clipboard.writeText` when `window.isSecureContext`; the label turns to "Copied" for
   `resetMs` (2 s), announced through a polite live region. Without a secure context, or when the write rejects, the
   button shows "Copy failed" and a read-only input with the value appears, focused and selected, with the
   "Press Ctrl+C" hint, so the user copies by hand. `isIconOnly` uses `IconButton`.
6. **`ExternalLink`**: `<a target="_blank">` with `rel` holding `noopener noreferrer` plus any app tokens, and a
   `sr-only` "(opens in a new tab)" from the messages. Client component (the copy follows `UiLocaleProvider`).
7. **`useDismissed(key, days)`**: `{ isDismissed, dismiss, restore }`. `localStorage[key]` holds the dismissal date
   as `YYYY-MM-DD` (local); dismissed while fewer than `days` calendar days have passed. Every storage access is in
   try/catch (a blocked storage means "not dismissed", and `dismiss` still hides it for the session). On the server
   and during hydration `isDismissed` is `true`, so a dismissed banner never flashes. Pure helpers
   `getDismissalDate` and `isDismissalActive` are exported for tests.
8. **SegmentedControl cue**: the checked option and `SEGMENT_ACTIVE_CLASS` add an inset 1 px ring in `foreground`
   (`ring-1 ring-inset ring-foreground`): an outline that does not rely on the accent colour and does not change
   the segment's width (a weight change would). The focus outline stays separate (`outline`).

## Phase 1: tests first

File: `foundation/ui/tests/adoption-gaps-319.test.tsx` (happy-dom). Red on master (imports missing):
disclosure (Escape returns focus, capture-phase outside press closes even when the target stops propagation,
link click closes, `closeKey` change closes, keyboard-only `focusout`), confirm (stakes shown, success toast and
close, failure stays with the error, no auto-expiry), modal trigger (opens, closes on success, focus back),
copy (copied state, fallback input selected without a secure context, rejected write), external link (target, rel,
sr text in `pl`), dismissed (date-only value, expiry after N days, blocked storage), segmented cue.

## Phase 2: implementation

Files: `src/ui/disclosure-menu.tsx`, `src/ui/confirm-action-button.tsx`, `src/ui/action-form-modal.tsx`,
`src/ui/copy-button.tsx`, `src/ui/external-link.tsx`, `src/ui/use-dismissed.ts`, `src/ui/segmented-control.tsx`,
`src/ui/segment-classes.ts`, `src/ui/index.ts`, `src/messages/{en,pl}.ts`.

## Phase 3: docs and version

`foundation/ui/README.md` (primitives table, a section on the new components), `foundation/ui/CHANGELOG.md`
(0.1.16; 0.1.15 was published meanwhile), version in `package.json` and `package-lock.json`.

## Progress

- [x] Phase 1: tests first (red on master: the new exports are missing)
- [x] Phase 2: implementation
- [x] Phase 3: docs, CHANGELOG and version 0.1.16

Gates on the branch: see the PR.
