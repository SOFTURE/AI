---
change_id: mcp-access-token-focus-590
title: "mcp-access: TokenManager moves focus to the issued token and back to the name field (issue #590)"
status: archived
roadmap_item: null
issue: 590
branch: claude/project-thread-i2aag6
created: 2026-10-19
updated: 2026-10-19
archived_at: 2026-10-19
---

## Intent

Close [issue #590](https://github.com/SOFTURE/AI/issues/590): in `TokenManager` the "Done, hide the token" button
unmounts with the issued-token panel and focus falls to `<body>`, and the panel takes no focus when it appears, so a
screen reader user is not taken to the token that is shown only once.

## Context

Labels: `bug`, `pkg: mcp-access`, `adoption`. mcp-access 0.2.4 is the latest on npm and on master. Releases are
batched by the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`. Issue #589 changes
`TokenManager` (props, headings) in a parallel thread; master is merged in before the merge.

## Acceptance

- When the issued-token panel appears (also for a second token issued while it is shown), focus moves to its heading,
  which has `tabIndex={-1}`.
- On "Done" the panel unmounts and focus lands on the issue form's name field, not on `<body>`.
- Nothing else in `TokenManager` changes.

## Notes

- Framing: skipped. The issue states the problem and the proposal.

## Decisions (auto)

- The name field is found through a ref on the issue form (`form.elements.namedItem("name")`), not a ref on
  `TextField`: it needs no change in `@softure-ai/ui` and holds for any field markup.
- The heading takes focus in an effect keyed by the issued token's id, so a new token issued while the panel is
  open is announced too.
- Focus returns in `requestAnimationFrame` after the dismissal, as the issue proposes, so it runs once the panel has
  unmounted.
