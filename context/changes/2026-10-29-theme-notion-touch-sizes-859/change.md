---
change_id: theme-notion-touch-sizes-859
title: "theme-notion: 44 px touch sizes for Button, SelectTrigger and SelectItem (issue #859)"
status: open
roadmap_item: null
issue: 859
branch: claude/project-thread-m4v8sy
created: 2026-10-29
updated: 2026-10-29
---

## Intent

Close [issue #859](https://github.com/SOFTURE/AI/issues/859): the controls a phone view taps most cannot reach the
`touch-target` token (44 px, #742). Add `Button` sizes `touch` and `icon-touch`, a `SelectTrigger` size `touch`, and a
`touch` size for `SelectItem` (per item or for a whole `SelectContent`), all overridable per breakpoint so an app can
fall back to the pointer sizes on a desktop.

## Context

Labels: `enhancement`, `pkg: theme-notion`. Runs in parallel with #858 (theme-notion) and #860 (theme-kit). No version
bump: the coordinator releases the batch.

## Constraints

- Backwards compatible: existing sizes, defaults and class strings stay; only new options.
- Every changed line of `src/ui` is listed in `tests/upstream/deltas.ts`; the parity fixture is regenerated.
- The visual change is mirrored in the "NOTION · Design System" artifact.

## Notes

- Framing: skipped. The issue names the gap, the sizes and the app's workaround.
