---
change_id: marketing-kit-photo-cover-layouts-1163
title: "marketing-kit: photo cover layouts (caption position, kicker, pill, tone) (issue #1163)"
status: archived
roadmap_item: null
issue: 1163
branch: claude/project-thread-0hu7au
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close [issue #1163](https://github.com/SOFTURE/AI/issues/1163), the follow-up to #1137: an adopting app lets its agent
pick the photo cover's layout for each photo. `renderPhotoCover` gets `layout` (`photo`, `title-bottom`,
`title-center`, `title-top`, `kicker-title`, `pill`), `kicker` and `tone` (`light` or `dark`). Every layout is fitted
inside the centre 4:5 band, in the half or third it names, and refused, never clipped, when it does not fit. The scrim
follows the text.

## Context

Labels: `pkg: marketing-kit`. Builds on `src/og/photo-cover.ts` (0.16.0). Ships as marketing-kit 0.17.0, after
0.16.1 (#1159) from a parallel thread.

## Constraints

- Existing calls are unchanged: no `layout` means `title-bottom` with a caption and `photo` without one.
- Errors are values (`OgResult`): an overlong kicker or pill text and a missing glyph are errors, as for the caption.
- Deterministic, no network, no system fonts, no Playwright in the `og` entry.

## Notes

- Framing: skipped. The issue names the inputs, the behaviour and the acceptance.

## Done

`renderPhotoCover` takes `layout` (`photo`, `title-bottom`, `title-center`, `title-top`, `kicker-title`, `pill`),
`kicker` and `tone`; each layout keeps its text to its half or third of the centre 4:5 band, measured on the pixels,
and refuses text that does not fit; the scrim follows the text. Calls without `layout` are unchanged. Ships in
marketing-kit 0.17.0 together with #1159.
