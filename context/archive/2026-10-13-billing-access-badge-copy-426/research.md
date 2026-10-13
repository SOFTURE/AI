---
change_id: billing-access-badge-copy-426
---

# Research: billing-access-badge-copy-426

## Where the badge lives

- `modules/billing/src/ui/access-badge.tsx`: `AccessBadge`, `getAccessBadgeKind`, kinds `trial`, `trial-ending`,
  `paid`, `paid-ending`, `lifetime`, `unlimited`, `read-only`; `describe()` builds `{ status, detail? }` from
  `messages.badge` and the formatters in `format.ts`; slots `root`, `status`, `detail`; the tone colours only the
  `status` slot (`TONE` map); the root carries `data-status`, `data-ending`, `data-unlimited`.
- `modules/billing/src/next/access.tsx`: `CurrentAccessBadge` passes its props through to `AccessBadge`.
- `src/next/pages.tsx` renders both with defaults (account page and admin history): unaffected by additive props.
- Exports: `src/ui/index.ts` (types `AccessBadgeKind`, `AccessBadgeProps`, `AccessBadgeSlot`, `AccessTone`).
- Tests: `modules/billing/tests/access.test.tsx` (happy-dom, testing-library) assert exact `textContent` and classes.
- Docs: README §4 ("Both take options") and §8 "Appearance".

## Styling facts

- The `sm` breakpoint is available (`sft:sm:` is used in `pages.tsx`; ui's static theme defines `--breakpoint-sm`).
- Tinted surfaces exist as `sft:border-<tone>/50 sft:bg-<tone>/10` (`access-notice.tsx`, ui `FormError`).
- `sft:sr-only` is used by ui components (`checklist.tsx`) for screen-reader-only text.

## What the issue's app needs, mapped

| Need | Answer |
| --- | --- |
| "Trial · 53 days" as one line | `texts.trial = ({ daysLeft }) => ({ status: ... })` with no detail |
| "Paid · 14 days" for paid and ending | `texts["paid-ending"]` gets `daysLeft` |
| "Unlimited access" for lifetime | `texts.lifetime = () => ({ status: ... })` |
| Short label on phones | `short` text + `variant="responsive"` |
| "Access status: …" for screen readers | `srPrefix` |
| `data-tone` for e2e and styles | root attribute |
| Tone on the whole pill | `toneScope="pill"` |
