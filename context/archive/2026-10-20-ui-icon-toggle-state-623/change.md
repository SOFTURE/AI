---
change_id: ui-icon-toggle-state-623
title: "ui: crossed-eye icon and a pressed look for IconButton toggles (issue #623)"
status: archived
roadmap_item: null
issue: 623
branch: claude/project-thread-gbfo12
created: 2026-10-20
updated: 2026-10-20
archived_at: 2026-10-20
---

## Intent

Close [issue #623](https://github.com/SOFTURE/AI/issues/623). `@softure-ai/ui` 0.3.3 cannot show the state of an icon
toggle: there is no crossed-out eye for a "show / hide" toggle, and an `IconButton` with `aria-pressed="true"` looks
exactly like an unpressed one. The issue also asks to export `IconProps`.

## Context

Labels: `enhancement`, `pkg: ui`, `adoption`. Additive; releases are batched by the coordinator: no version bump, the
CHANGELOG gets `## Unreleased`.

## Acceptance

- `EyeOffIcon` exists: the `EyeIcon` drawing plus an `m3 3 18 18` slash, on the shared icon frame.
- `IconButton` with `aria-pressed="true"` shows a pressed look (accent fill, on-accent text, an inset ring as a cue that
  does not rely on colour), also on hover; without `aria-pressed` its classes are unchanged in effect.
- `IconProps` is importable from `@softure-ai/ui` (a test proves it).
- README and CHANGELOG `## Unreleased` tell an app how to drop its local `EyeOffIcon` and its `[aria-pressed]` CSS.

## Notes

- Framing: skipped. The issue states the gap and the proposed fix.

## Decisions (auto)

- The pressed look mirrors `SEGMENT_ACTIVE_CLASS` (accent fill, `text-on-accent`, inset `ring-foreground`), so pressed
  toggles and chosen segments read the same and the state is not shown by colour alone.
- One pressed look for both tones: a pressed toggle is a state, not a destructive action.
- `IconProps` is already exported (`export interface` in `icons.tsx`, re-exported by `export *`); no code change, only a
  type-level test so it stays public.
