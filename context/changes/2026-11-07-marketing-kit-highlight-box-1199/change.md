---
change_id: marketing-kit-highlight-box-1199
title: "marketing-kit: the lit caption word on its own box, and a boxed cover accent (issue #1199)"
status: in_progress
roadmap_item: null
issue: 1199
branch: claude/project-thread-1p9fy6
created: 2026-11-07
updated: 2026-11-07
---

## Intent

Close [#1199](https://github.com/SOFTURE/AI/issues/1199):

- a footage film's `highlight` captions can light the current word on a box of its own colour with its own text
  colour (`captionHighlightStyle: "box"`), in the render and in the fast draft alike; `"text"` (the default) stays
  as it is;
- the app can check the box colours' contrast itself (an exported function);
- the photo cover can draw its accent as a box behind the kicker, so a weak accent is boxed instead of refused.

## Context

Labels: `pkg: marketing-kit`. Batched with #1200 into one marketing-kit release by this thread.

## Constraints

- Without the new options every film, draft and cover is unchanged.
- The new colour roles are optional: existing brands keep resolving.
- No test talks to an external service.

## Notes

- Framing: skipped. The issue names the API, the colours, the geometry and the tests.
