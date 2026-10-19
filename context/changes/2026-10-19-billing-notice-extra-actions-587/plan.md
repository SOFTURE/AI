---
change_id: billing-notice-extra-actions-587
status: open
---

# Plan: the app's own actions in the access notice (issue #587)

Input: change.md, research.md. Complexity: small (one prop on two components, one slot default, tests, docs).

## Phase 1: extraActions (TDD)

Files: `modules/billing/src/ui/access-notice.tsx`, `src/next/access.tsx`, `tests/access.test.tsx`.

1. Tests first:
   - a read-only notice with `extraActions={<a href="/account/export">Download your data</a>}` renders both links
     inside the `actions` slot, the payment link first;
   - an ending notice renders the extra action too;
   - a notice outside its reminder window with `extraActions` still renders nothing;
   - the `actions` slot default carries `sft:gap-3` and `sft:flex-wrap`.
2. `AccessNoticeProps.extraActions?: ReactNode`, documented; rendered after the `ButtonLink`.
3. `CurrentAccessNoticeProps.extraActions?: ReactNode`, forwarded.
4. `actions` default: `sft:flex sft:shrink-0 sft:flex-wrap sft:items-center sft:gap-3`.

## Phase 2: docs

`modules/billing/README.md` (account status section and the slots line) and `CHANGELOG.md` `## Unreleased` with
the migration for an app that kept its own notice for a second action.

## Progress

- [ ] Phase 1: extraActions (TDD)
- [ ] Phase 2: docs
