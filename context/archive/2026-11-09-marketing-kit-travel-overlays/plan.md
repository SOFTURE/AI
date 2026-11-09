---
change_id: marketing-kit-travel-overlays
status: done
---

# Plan: travel overlay kinds and style knobs

Input: change.md, research.md. Complexity: medium.

## Phase 1: schema and placement

- Kinds `hook_title`, `search_bar`, `place_card`, `counter`, `date_stamp`; fields `place`, `subtitle`, `value`,
  `from`, `unit`; style `position`, `entrance`, `typing_speed`, `colors {card,text,accent}`; per-kind refusals.
- Sizes and placement per kind; hook title exempt from one-at-a-time, spacing and segment crossing, with its own
  guards. Fonts per role and texts per role for the glyph check.

## Phase 2: drawing

- Render markup and tweens (fade, slide, type, none; counter tween; pin and magnifier SVG); draft events with the
  same placement and steps.

## Phase 3: tests, docs, release notes

- `overlay-kinds.test.ts`: each kind accepted and refused at its bounds, placement, hook guards, markup, draft
  events, a libass burn; role glyph test; schema snapshot regenerated. README, CHANGELOG 0.24.0.

## Acceptance

- Gates: typecheck, lint, test, build. Frames of render and draft looked at side by side.

## Decisions (auto)

- Minor release 0.24.0 (new public API; 0.23.0 was taken by the caption-card release); the deploy tool's dev range gains `^0.24.0`.
- `position` is top, middle or bottom; the hook title has a fixed place and refuses it.
- Durations up to 180 s only for the hook title; every other kind keeps 8 s.
- No caret in typed text: it sat after the hidden rest and looked generated.

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
