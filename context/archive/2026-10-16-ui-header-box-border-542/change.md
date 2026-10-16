---
change_id: ui-header-box-border-542
title: "ui: AppHeaderBar inner row sizes its padding inside its width (issue #542)"
status: archived
roadmap_item: null
issue: 542
branch: claude/project-thread-hjkgw5
created: 2026-10-16
updated: 2026-10-16
archived_at: 2026-10-16
---

## Intent

Close [issue #542](https://github.com/SOFTURE/AI/issues/542): in an app without a global `box-sizing: border-box`
reset, `AppHeaderBar`'s `inner` row (`w-full` plus `px-4`) is 2rem wider than the viewport, so the actions are cut
and the page scrolls sideways. The package must not depend on the host app's reset.

## Context

ui 0.3.1 is the latest on npm and on master. Releases are batched by the coordinator: no version bump here, the
CHANGELOG gets `## Unreleased`.

## Constraints

- No visual change in an app that already has the reset.
- `classNames` and `unstyled` keep working as today.

## Notes

- Framing: skipped. The issue names the cause, the slot and the fix.

## Decisions (auto)

- Add `sft:box-border` to the `inner` slot, as the issue proposes.
- The sweep the issue asks for found no other default class string that combines a full width with padding or a
  border without `box-border` (see research.md), so only `AppHeaderBar` changes.
