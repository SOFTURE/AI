---
change_id: billing-notice-extra-actions-587
---

# Research: billing-notice-extra-actions-587

Sources: `modules/billing/src/ui/access-notice.tsx`, `src/next/access.tsx`, `tests/access.test.tsx`,
`modules/billing/README.md` (account status, slots), `foundation/ui` (`ButtonLink`, `createSlotClassGetter`).

- `AccessNotice` is a server-safe, framework-free component: a `role="status"` root, a `message` paragraph and an
  `actions` div holding one `ButtonLink` to `paymentHref`. Slots `root`, `message`, `actions`; `unstyled` and
  `classNames` go through `createSlotClassGetter`. The `actions` default is `sft:flex sft:shrink-0`, with no gap.
- `CurrentAccessNotice` is an async server component that reads the entitlement and config and forwards
  `LinkComponent`, `tones`, `classNames`, `unstyled`. A `ReactNode` prop passed from a server component to it is
  fine (no server-client boundary is crossed; the notice has no client part).
- `getNoticeCopy` returns null outside the reminder window, so anything rendered inside the notice is hidden with it.
- Tests drive `AccessNotice` through `renderNotice(entitlement, extra)` with happy-dom; `CurrentAccessNotice` has no
  direct test (it is a thin wiring over the same component).
- The example app (`examples/next-app/app/account/billing/page.tsx`) uses the notice without new props; unaffected.
