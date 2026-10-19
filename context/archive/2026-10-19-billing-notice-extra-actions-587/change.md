---
change_id: billing-notice-extra-actions-587
title: "billing: AccessNotice and CurrentAccessNotice take the app's own extra actions (issue #587)"
status: archived
roadmap_item: null
issue: 587
branch: claude/project-thread-hymkls
created: 2026-10-19
updated: 2026-10-19
archived_at: 2026-10-19
---

## Intent

Close [issue #587](https://github.com/SOFTURE/AI/issues/587): `AccessNotice` (`/ui`) and `CurrentAccessNotice`
(`/next`) render one message and exactly one action, the payment link. An adopting app that shows a second action
next to it (a "Download your data" link to its export route, which answers "did I lose anything?" in the read-only
state) cannot keep it when it moves to the package.

## Context

Labels: `enhancement`, `pkg: billing`, `adoption`. billing 0.8.0 is the latest on npm and on master. Releases are
batched by the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`.

## Acceptance

- `AccessNotice` and `CurrentAccessNotice` take an optional `extraActions` (React nodes) rendered inside the
  `actions` slot after the payment link.
- Without `extraActions` the notice renders the same markup as before, apart from the `actions` slot's default
  classes gaining wrap and a gap.
- A notice outside its reminder window still renders nothing, extra actions included.

## Notes

- Framing: skipped. The issue states the gap and the proposal.

## Decisions (auto)

- `extraActions?: ReactNode` (the issue's first proposal) instead of a built-in `exportHref` plus a
  `notice.downloadData` message: the app keeps its own link component, wording and target, and billing stays free of
  any knowledge of privacy's export route. Simplest, and covers any second action, not only the export.
- The nodes render after the payment link, inside the `actions` slot, in every state that shows the notice (ending
  and ended). An app that wants the action only when read-only passes it conditionally; `CurrentAccessNotice`
  exposes no entitlement, so for that case the app uses `AccessNotice` with `getCurrentEntitlement()`, or always
  passes it (the issue's case: the export is useful in both states).
- The `actions` slot default becomes `sft:flex sft:shrink-0 sft:flex-wrap sft:items-center sft:gap-3`, so two
  actions sit apart and wrap on a narrow screen.
